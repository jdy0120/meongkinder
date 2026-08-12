-- job-051: 요금제를 유치원 소유로, 이용권을 아이 소유로, 매출을 별도 원장으로.
--
-- 세 가지가 한 마이그레이션에 묶인 이유는 서로가 서로의 전제이기 때문이다:
--   - 요금제에 주인이 없으면 "유치원별 이용권"이 성립하지 않는다 (지금은 A유치원이 만든
--     요금제가 B유치원 목록에 그대로 뜬다 — subscription_plans 에 tenant_id 가 없다).
--   - 이용권에 아이가 없으면 일권/한달권을 구분할 수 없다 (출석 차감이 매장의 "가장 최근
--     구독 1건"을 보고 전체 원생의 규칙을 정한다).
--   - 매출은 그 둘이 정해져야 "무엇을 누구에게 팔아 얼마 받았나"로 집계된다.

-- ─────────────────────────────────────────────────────────────
-- 1. 요금제를 유치원 소유로 (scope=TENANT ⇒ tenant_id 필수)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "subscription_plans" ADD COLUMN "tenant_id" UUID;

-- 백필 ①: 이 요금제를 실제로 구독한 테넌트가 있으면 그쪽으로 귀속시킨다.
UPDATE "subscription_plans" p
SET "tenant_id" = sub."tenant_id"
FROM (
  SELECT DISTINCT ON ("planId") "planId", "tenant_id"
  FROM "tenant_subscriptions"
  ORDER BY "planId", "created_at" ASC
) sub
WHERE p."id" = sub."planId" AND p."scope" = 'TENANT';

-- 백필 ②: 아무도 구독하지 않은 요금제(seed 로 들어간 BASIC/PREMIUM 등)는 가장 먼저 생긴
-- 테넌트에 붙인다. 임의 배정이지만, 이 시점에 TENANT 요금제를 만드는 UI 가 아직 없어서
-- 실사용 데이터가 아니다 — 판매 이력이 없으므로 원장이 지우거나 고쳐 쓰면 된다.
UPDATE "subscription_plans"
SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
WHERE "scope" = 'TENANT' AND "tenant_id" IS NULL;

-- 백필 ③: 테넌트가 하나도 없는 DB(빈 환경)라면 귀속시킬 곳이 없다. 이 경우 그 요금제를
-- 구독한 기록도 존재할 수 없으므로(tenant_subscriptions 는 tenant_id NOT NULL) 지운다.
-- 아래 CHECK 제약을 통과시키기 위해 필요하다.
DELETE FROM "subscription_plans" WHERE "scope" = 'TENANT' AND "tenant_id" IS NULL;

ALTER TABLE "subscription_plans"
  ADD CONSTRAINT "subscription_plans_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- scope 와 tenant_id 는 반드시 짝이 맞아야 한다. 애플리케이션 검증만 두지 않는 이유는,
-- 여기서 어긋나면 곧 **다른 유치원에 상품이 새는 사고**라서다.
--   TENANT   = 유치원이 파는 원생 이용권  ⇒ 주인이 있다
--   PLATFORM = pawlog 가 파는 매장 개설권 ⇒ 주인이 없다
ALTER TABLE "subscription_plans"
  ADD CONSTRAINT "subscription_plans_scope_tenant_ck"
  CHECK (
    ("scope" = 'TENANT' AND "tenant_id" IS NOT NULL)
    OR ("scope" <> 'TENANT' AND "tenant_id" IS NULL)
  );

CREATE INDEX "subscription_plans_tenant_id_scope_is_active_idx"
  ON "subscription_plans"("tenant_id", "scope", "is_active");

-- ─────────────────────────────────────────────────────────────
-- 2. 이용권을 아이 소유로
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "tenant_subscriptions" ADD COLUMN "pet_id" TEXT;

-- 백필: 이 구독이 만든 원장(ledger)이 가리키는 아이. job-045 의 백필과 같은 축이다.
UPDATE "tenant_subscriptions" ts
SET "pet_id" = sub."pet_id"
FROM (
  SELECT DISTINCT ON ("subscriptionId") "subscriptionId", "pet_id"
  FROM "subscription_ledgers"
  WHERE "subscriptionId" IS NOT NULL
  ORDER BY "subscriptionId", "created_at" ASC
) sub
WHERE ts."id" = sub."subscriptionId";

-- NOT NULL 로 올리지 않는다: 원장이 하나도 없는 레거시 구독(어느 아이 것인지 복원할 근거가
-- 없다)이 남아 있을 수 있다. pet_id 가 null 인 구독은 새 코드에서 **어느 아이에게도 매칭되지
-- 않아** 차감에 관여하지 않는다 — 원래 의미가 없던 로우이므로 그게 맞는 동작이다.
-- 신규 판매는 서비스가 pet_id 를 강제한다.
ALTER TABLE "tenant_subscriptions"
  ADD CONSTRAINT "tenant_subscriptions_pet_id_fkey"
  FOREIGN KEY ("pet_id") REFERENCES "pets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "tenant_subscriptions_pet_id_status_idx"
  ON "tenant_subscriptions"("pet_id", "status");

-- ─────────────────────────────────────────────────────────────
-- 3. 매출 원장 (입금 기준)
-- ─────────────────────────────────────────────────────────────
-- payments 를 재사용하지 않는 이유: 그 테이블은 토스 결제 기록이라 paymentKey 가 유니크다.
-- 현장 현금 결제에 가짜 키를 넣으면 PG 대사에 못 쓰게 된다.
CREATE TABLE "tenant_sales" (
  "id"              TEXT NOT NULL,
  "tenant_id"       UUID NOT NULL,
  "plan_id"         TEXT,
  "pet_id"          TEXT,
  "subscription_id" TEXT,
  "payment_id"      TEXT,
  "amount"          INTEGER NOT NULL,
  "method"          TEXT NOT NULL,
  "sold_at"         TIMESTAMP(3) NOT NULL,
  "canceled_at"     TIMESTAMP(3),
  "memo"            TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_sales_payment_id_key" ON "tenant_sales"("payment_id");
CREATE INDEX "tenant_sales_tenant_id_sold_at_idx" ON "tenant_sales"("tenant_id", "sold_at");
CREATE INDEX "tenant_sales_pet_id_idx" ON "tenant_sales"("pet_id");

ALTER TABLE "tenant_sales"
  ADD CONSTRAINT "tenant_sales_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 아래 넷은 전부 SET NULL 이다. 요금제를 판매중지하거나 원생이 퇴원해도
-- **매출 기록 자체는 남아야** 월별 매출이 과거로 소급해 바뀌지 않는다.
ALTER TABLE "tenant_sales"
  ADD CONSTRAINT "tenant_sales_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_sales"
  ADD CONSTRAINT "tenant_sales_pet_id_fkey"
  FOREIGN KEY ("pet_id") REFERENCES "pets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_sales"
  ADD CONSTRAINT "tenant_sales_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "tenant_subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_sales"
  ADD CONSTRAINT "tenant_sales_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
