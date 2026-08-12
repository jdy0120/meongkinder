-- job-033: 회원↔테넌트 관계를 조인 테이블(TenantMembership)로 전환.
--
--  변경 전: users.tenant_id 하나 + users.role 하나  → 회원은 정확히 한 테넌트에 한 역할로만 속함
--  변경 후: tenant_memberships(user_id, tenant_id, role, status)
--           → 소속 없는 회원 존재 가능, 한 회원이 여러 테넌트에 다른 자격으로 소속 가능
--
-- 함께 바뀌는 것:
--   * users.email 이 테넌트별 유니크 -> 전역 유니크 (회원 1명 = 계정 1개)
--   * users.role 은 플랫폼 레벨만 보관 (USER | SUPER_ADMIN)
--   * pets/files/file_temps.tenant_id 가 nullable (소속 없는 회원의 펫/파일)
--   * user_infos / user_terms_agreements 는 회원 귀속이므로 tenant_id 제거

-- ── 0. 사전 안전 검사 ────────────────────────────────────────────────────────
-- users.email 을 전역 유니크로 올리기 전에, 서로 다른 테넌트에 같은 이메일로 가입한
-- 계정이 있으면 조용히 깨지는 대신 명확한 메시지로 중단시킨다(수동 병합이 필요한 상황).
DO $$
DECLARE
  duplicated INT;
BEGIN
  SELECT COUNT(*) INTO duplicated
  FROM (SELECT email FROM "users" GROUP BY email HAVING COUNT(*) > 1) AS d;

  IF duplicated > 0 THEN
    RAISE EXCEPTION
      'job-033 중단: 여러 테넌트에 중복된 이메일 계정이 % 건 있습니다. users.email 을 전역 유니크로 전환하려면 먼저 수동 병합이 필요합니다.',
      duplicated;
  END IF;
END $$;

-- ── 1. tenant_memberships 신설 ───────────────────────────────────────────────
CREATE TABLE "tenant_memberships" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "tenant_id"   UUID NOT NULL,
  "role"        TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "approved_at" TIMESTAMP(3),
  "approved_by" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_memberships_user_id_tenant_id_key"
  ON "tenant_memberships" ("user_id", "tenant_id");
CREATE INDEX "tenant_memberships_user_id_idx" ON "tenant_memberships" ("user_id");
CREATE INDEX "tenant_memberships_tenant_id_idx" ON "tenant_memberships" ("tenant_id");
CREATE INDEX "tenant_memberships_tenant_id_status_idx"
  ON "tenant_memberships" ("tenant_id", "status");

ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. 기존 users.tenant_id + role 을 멤버십으로 백필 ────────────────────────
-- 이미 운영 중이던 계정이므로 승인 대기(PENDING)가 아니라 ACTIVE 로 넣는다.
-- SUPER_ADMIN 은 특정 테넌트에 속하지 않으므로 멤버십을 만들지 않는다.
INSERT INTO "tenant_memberships"
  ("id", "user_id", "tenant_id", "role", "status", "approved_at", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  u."id",
  u."tenant_id",
  CASE
    WHEN u."role" = 'TENANT_ADMIN' THEN 'TENANT_ADMIN'
    WHEN u."role" = 'STAFF'        THEN 'STAFF'
    ELSE 'GUARDIAN'
  END,
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."tenant_id" IS NOT NULL
  AND u."role" <> 'SUPER_ADMIN';

-- 테넌트 역할은 이제 멤버십이 갖는다. users.role 에는 플랫폼 레벨만 남긴다.
UPDATE "users" SET "role" = 'USER' WHERE "role" IN ('TENANT_ADMIN', 'STAFF', 'GUARDIAN');

-- ── 3. RLS 정책 정리 ─────────────────────────────────────────────────────────
-- users / user_infos / user_terms_agreements 는 더 이상 테넌트 스코프가 아니다.
DROP POLICY IF EXISTS "tenant_isolation" ON "users";
DROP POLICY IF EXISTS "tenant_isolation" ON "user_infos";
DROP POLICY IF EXISTS "tenant_isolation" ON "user_terms_agreements";
ALTER TABLE "users"                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE "user_infos"            DISABLE ROW LEVEL SECURITY;
ALTER TABLE "user_terms_agreements" DISABLE ROW LEVEL SECURITY;

-- nullable 이 된 테이블은 "테넌트 컨텍스트 없음 = tenant_id IS NULL 인 개인 데이터"가 되도록
-- IS NOT DISTINCT FROM 으로 바꾼다. (= 비교는 NULL 을 만나면 NULL 이라 개인 데이터가 영원히 안 잡힌다)
DROP POLICY IF EXISTS "tenant_isolation" ON "pets";
CREATE POLICY "tenant_isolation" ON "pets"
  USING      (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "tenant_isolation" ON "files";
CREATE POLICY "tenant_isolation" ON "files"
  USING      (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS "tenant_isolation" ON "file_temps";
CREATE POLICY "tenant_isolation" ON "file_temps"
  USING      (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 신설 tenant_memberships 는 의도적으로 RLS 를 걸지 않는다:
-- "내가 속한 테넌트 목록" 조회가 테넌트 컨텍스트 밖(교차 테넌트)에서 일어나야 하기 때문.
-- 스코프는 서비스 레이어에서 userId/tenantId 로 명시한다.

-- ── 4. users 컬럼 재편 ───────────────────────────────────────────────────────
DROP INDEX IF EXISTS "users_tenant_id_idx";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenant_id_email_key";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenant_id_fkey";
ALTER TABLE "users" DROP COLUMN "tenant_id";
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");

-- ── 5. user_infos / user_terms_agreements 테넌트 분리 ────────────────────────
DROP INDEX IF EXISTS "user_infos_tenant_id_idx";
ALTER TABLE "user_infos" DROP CONSTRAINT IF EXISTS "user_infos_tenant_id_fkey";
ALTER TABLE "user_infos" DROP COLUMN "tenant_id";

DROP INDEX IF EXISTS "user_terms_agreements_tenant_id_idx";
ALTER TABLE "user_terms_agreements" DROP CONSTRAINT IF EXISTS "user_terms_agreements_tenant_id_fkey";
ALTER TABLE "user_terms_agreements" DROP COLUMN "tenant_id";

-- ── 6. pets / files / file_temps 를 nullable 로 ──────────────────────────────
-- pets 는 테넌트가 사라져도 보호자의 펫으로 남아야 하므로 CASCADE -> SET NULL.
ALTER TABLE "pets" ALTER COLUMN "tenant_id" DROP NOT NULL;
ALTER TABLE "pets" DROP CONSTRAINT IF EXISTS "pets_tenant_id_fkey";
ALTER TABLE "pets"
  ADD CONSTRAINT "pets_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "files"      ALTER COLUMN "tenant_id" DROP NOT NULL;
ALTER TABLE "file_temps" ALTER COLUMN "tenant_id" DROP NOT NULL;
