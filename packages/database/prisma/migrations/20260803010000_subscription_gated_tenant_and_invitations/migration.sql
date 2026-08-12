-- job-034: 매장 개설을 구독 기반으로 게이팅 + 미가입자 초대.
--
--  1) SubscriptionPlan.scope — 한 테이블에 섞여 있던 두 상품을 구분한다.
--     "TENANT"(원생 이용권: 10회권/월무제한/호텔1박권) vs "PLATFORM"(매장 개설권 SaaS 요금)
--  2) UserBillingKey / UserSubscription — 개설권은 테넌트가 생기기 전에 결제해야 하므로
--     빌링키와 구독 모두 회원 소유여야 한다. UserSubscription.tenant_id 가 UNIQUE 이므로
--     구독 1건으로 매장 1개만 열 수 있다.
--  3) TenantInvitation — 아직 회원이 아닌 보호자의 연락처/아이 정보를 미리 저장해 두고,
--     같은 이메일/전화번호로 가입하면 자동 매칭해 멤버십과 펫을 만든다.

-- ── 1. SubscriptionPlan.scope ───────────────────────────────────────────────
-- 기존 요금제는 전부 원생 이용권이므로 기본값 'TENANT' 그대로 둔다.
ALTER TABLE "subscription_plans" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'TENANT';
CREATE INDEX "subscription_plans_scope_is_active_idx"
  ON "subscription_plans" ("scope", "is_active");

-- ── 2. 회원 소유 빌링키 ─────────────────────────────────────────────────────
CREATE TABLE "user_billing_keys" (
  "id"           TEXT NOT NULL,
  "user_id"      TEXT NOT NULL,
  "customer_key" TEXT NOT NULL,
  "billing_key"  TEXT NOT NULL,
  "card_name"    TEXT,
  "card_number"  TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_billing_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_billing_keys_user_id_key" ON "user_billing_keys" ("user_id");
CREATE UNIQUE INDEX "user_billing_keys_customer_key_key" ON "user_billing_keys" ("customer_key");

ALTER TABLE "user_billing_keys"
  ADD CONSTRAINT "user_billing_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. 매장 개설권 구독 ─────────────────────────────────────────────────────
CREATE TABLE "user_subscriptions" (
  "id"                TEXT NOT NULL,
  "user_id"           TEXT NOT NULL,
  "plan_id"           TEXT NOT NULL,
  "billing_key_id"    TEXT,
  "tenant_id"         UUID,
  "status"            TEXT NOT NULL DEFAULT 'ACTIVE',
  "start_date"        TIMESTAMP(3) NOT NULL,
  "end_date"          TIMESTAMP(3) NOT NULL,
  "next_payment_date" TIMESTAMP(3) NOT NULL,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- 구독 1건 = 매장 1개를 보장하는 핵심 제약.
CREATE UNIQUE INDEX "user_subscriptions_tenant_id_key" ON "user_subscriptions" ("tenant_id");
CREATE INDEX "user_subscriptions_user_id_idx" ON "user_subscriptions" ("user_id");
CREATE INDEX "user_subscriptions_user_id_status_idx" ON "user_subscriptions" ("user_id", "status");

ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_billing_key_id_fkey"
  FOREIGN KEY ("billing_key_id") REFERENCES "user_billing_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. 테넌트 초대 ──────────────────────────────────────────────────────────
CREATE TABLE "tenant_invitations" (
  "id"               TEXT NOT NULL,
  "tenant_id"        UUID NOT NULL,
  "role"             TEXT NOT NULL DEFAULT 'GUARDIAN',
  "email"            TEXT,
  "phone"            TEXT,
  "guardian_name"    TEXT,
  "pet_name"         TEXT,
  "pet_species"      TEXT,
  "pet_breed"        TEXT,
  "pet_birth_date"   DATE,
  "note"             TEXT,
  "status"           TEXT NOT NULL DEFAULT 'PENDING',
  "token"            TEXT NOT NULL,
  "invited_by"       TEXT NOT NULL,
  "accepted_user_id" TEXT,
  "accepted_at"      TIMESTAMP(3),
  "expires_at"       TIMESTAMP(3) NOT NULL,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_invitations_token_key" ON "tenant_invitations" ("token");
CREATE INDEX "tenant_invitations_tenant_id_status_idx" ON "tenant_invitations" ("tenant_id", "status");
-- 가입 시 이메일/전화번호로 대기 중인 초대를 찾는 경로라 각각 인덱스가 필요하다.
CREATE INDEX "tenant_invitations_email_idx" ON "tenant_invitations" ("email");
CREATE INDEX "tenant_invitations_phone_idx" ON "tenant_invitations" ("phone");

ALTER TABLE "tenant_invitations"
  ADD CONSTRAINT "tenant_invitations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tenant_invitations 는 테넌트 스코프 모델이지만 RLS 를 걸지 않는다:
-- 회원가입 시점(테넌트 컨텍스트 없음)에 이메일/전화번호로 전 테넌트를 가로질러 조회해야 하기 때문.
-- 관리자 조회 경로는 Prisma Extension 이 tenantId 를 자동 주입해 스코프한다.
