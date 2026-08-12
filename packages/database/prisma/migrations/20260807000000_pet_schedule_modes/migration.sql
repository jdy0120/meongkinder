-- job-053: 등원 스케줄을 두 방식으로 — 매주 반복(WEEKLY) / 날짜 지정(MONTHLY).
--
-- 지금까지는 `pets.schedule_days`(요일 배열) 하나뿐이라 "다음 주 화·목만 온다"는 아이를
-- 표현할 방법이 없었다. 그 아이들은 출석부에 아예 뜨지 않아 원장이 수첩으로 관리했고,
-- 앱 밖으로 나간 정보는 알림장·이용권 차감과 영영 연결되지 않는다.
--
-- ⚠️ 요일 패턴을 날짜로 펼쳐 넣지 않는다. 펼치면 ① 패턴 수정 시 미래 행을 다시 써야 하고
-- ② 펼치는 작업이 한 번 밀리면 그 달 출석부가 조용히 빈다. 반복은 반복인 채로 둔다.

-- ─────────────────────────────────────────────────────────────
-- 1. 스케줄 입력 방식
-- ─────────────────────────────────────────────────────────────
-- 기본값이 WEEKLY 인 이유: 기존 원생은 전부 schedule_days 로 돌고 있다. MONTHLY 를
-- 기본으로 두면 이 마이그레이션 직후 **모든 원생의 출석부가 빈다**(pet_schedules 는
-- 방금 만든 빈 테이블이므로). 값을 옮기는 백필이 아니라, 읽는 쪽을 그대로 두는 선택이다.
ALTER TABLE "pets" ADD COLUMN "schedule_type" TEXT NOT NULL DEFAULT 'WEEKLY';

-- ─────────────────────────────────────────────────────────────
-- 2. 날짜 지정 등원일
-- ─────────────────────────────────────────────────────────────
CREATE TABLE "pet_schedules" (
  "id"         TEXT NOT NULL,
  "tenant_id"  UUID NOT NULL,
  "pet_id"     TEXT NOT NULL,
  "date"       DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pet_schedules_pkey" PRIMARY KEY ("id")
);

-- 같은 아이의 같은 날짜가 두 번 들어가면 출석부가 그 아이를 두 번 만든다.
CREATE UNIQUE INDEX "pet_schedules_pet_id_date_key" ON "pet_schedules"("pet_id", "date");
-- "이 매장 · 이 달"이 유일한 조회 패턴이다 (달력 화면 + 출석부 자동 생성).
CREATE INDEX "pet_schedules_tenant_id_date_idx" ON "pet_schedules"("tenant_id", "date");

ALTER TABLE "pet_schedules"
  ADD CONSTRAINT "pet_schedules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 아이가 지워지면 예정일도 의미가 없다 (매출과 달리 남겨 둘 이유가 없는 계획 데이터).
ALTER TABLE "pet_schedules"
  ADD CONSTRAINT "pet_schedules_pet_id_fkey"
  FOREIGN KEY ("pet_id") REFERENCES "pets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 3. 테넌트 격리 (RLS)
-- ─────────────────────────────────────────────────────────────
-- 앱은 Prisma Extension 으로 tenantId 를 주입하지만, RLS 는 그게 뚫렸을 때의 이중
-- 방어선이다 (docs/multi-tenant-migration-plan.md). 다른 테넌트 테이블과 같은 정책.
ALTER TABLE "pet_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pet_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "pet_schedules"
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
