-- job-033 (선행): 커밋된 마이그레이션과 schema.prisma 사이의 기존 드리프트 보정.
--
-- `prisma migrate diff --from-config-datasource --to-schema` 로 검출된 두 건이다.
-- 둘 다 dev 에서 `prisma db push` 로 스키마를 바꾸고 마이그레이션을 남기지 않아 생긴 것으로,
-- CLAUDE.md §10 이 경고하는 바로 그 상황이다 — dev 는 멀쩡한데 운영은 `migrate deploy` 만
-- 재생하므로 컬럼이 실제로 존재하지 않는다.
--
--  1) social_accounts: 0_init 이 "accountId" + 소셜 토큰 4종을 만들지만 schema.prisma 는
--     "providerAccountId" 하나만 선언한다(토큰 컬럼은 주석 처리됨). 운영에서는 Prisma Client 가
--     없는 컬럼을 조회하고 accountId NOT NULL 제약까지 걸려 소셜 로그인이 전부 실패한다.
--  2) attendances: UNIQUE 제약 이름이 마이그레이션과 Prisma 기대값이 서로 다르다(동작엔 영향 없음).
--
-- dev DB 는 이미 db push 로 목표 형태일 수 있으므로 모든 단계를 조건부로 실행한다.

-- ── 1. social_accounts.accountId -> providerAccountId ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'accountId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'providerAccountId'
  ) THEN
    ALTER TABLE "social_accounts" RENAME COLUMN "accountId" TO "providerAccountId";
  END IF;
END $$;

-- 유니크 인덱스도 새 컬럼명 기준으로 다시 만든다.
DROP INDEX IF EXISTS "social_accounts_provider_accountId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_provider_providerAccountId_key"
  ON "social_accounts" ("provider", "providerAccountId");

-- 유저별 소셜 토큰은 schema.prisma 에서 주석 처리되어 있다(알림톡 등은 SaaS 키로 발송하므로
-- 로그인 용도에는 불필요). 실제 컬럼도 제거해 스키마와 일치시킨다.
ALTER TABLE "social_accounts" DROP COLUMN IF EXISTS "accessToken";
ALTER TABLE "social_accounts" DROP COLUMN IF EXISTS "accessTokenExpiresAt";
ALTER TABLE "social_accounts" DROP COLUMN IF EXISTS "refreshToken";
ALTER TABLE "social_accounts" DROP COLUMN IF EXISTS "refreshTokenExpiresAt";

-- ── 2. attendances UNIQUE 제약 이름 정렬 ────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendances_pet_id_date_key'
  ) THEN
    ALTER TABLE "attendances"
      RENAME CONSTRAINT "attendances_pet_id_date_key" TO "attendances_petId_date_key";
  END IF;
END $$;
