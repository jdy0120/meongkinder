-- job-045: 이용권 잔액을 **회원**이 아니라 **아이** 단위로 체인한다.
--
-- 왜 바꾸는가 (두 가지가 동시에 깨져 있었다):
--
--  1. 계정 없는 원생은 아예 차감이 안 됐다. job-040 이후 매장은 전화번호만으로 원생을
--     등록하고(그게 정상 경로다), 도입 첫날엔 원생 전원이 그 상태다. 그런데 원장(ledger)이
--     userId 로 체인돼 있어 `AttendanceService.deductIfLinked` 가 통째로 건너뛰었다.
--     즉 **회수권을 파는 매장이 도입 첫날 회수권을 한 번도 차감하지 못한다.**
--
--  2. 형제견을 맡기는 보호자는 이용권을 아이마다 산다. 회원 기준이면 두 마리가 한 지갑을
--     나눠 써서 "초코 10회권"과 "두부 10회권"을 구분할 수 없다.
--
-- 파는 단위가 아이이므로 원장도 아이 단위여야 한다. userId 는 지우지 않고 **감사 정보**로
-- 남긴다(그때 누구에게 안내했는지) — 대신 nullable 로 낮춰 계정 없는 원생도 기록된다.

-- ── 1. pet_id 추가 (백필 동안만 nullable) ────────────────────────────────────
ALTER TABLE "subscription_ledgers" ADD COLUMN "pet_id" TEXT;

-- ── 2. 백필 ──────────────────────────────────────────────────────────────────
-- (a) 출석에 연결된 내역은 그 출석의 아이가 정답이다. 가장 정확한 경로라 먼저 채운다.
UPDATE "subscription_ledgers" l
   SET "pet_id" = a."petId"
  FROM "attendances" a
 WHERE l."attendance_id" = a."id" AND l."pet_id" IS NULL;

-- (b) 남은 것은 출석과 무관한 수기 충전/보정이다. 그 회원이 그 매장에 맡긴 아이가 **정확히
--     한 마리**일 때만 자동 귀속한다 — 두 마리 이상이면 어느 쪽 지갑인지 데이터로 알 수 없고,
--     찍어서 붙이면 돈이 잘못된 아이에게 간다. 사람이 판단해야 하는 건 사람에게 남긴다.
UPDATE "subscription_ledgers" l
   SET "pet_id" = p."id"
  FROM "pets" p
 WHERE l."pet_id" IS NULL
   AND p."userId" = l."userId"
   AND p."tenant_id" = l."tenant_id"
   AND (SELECT count(*) FROM "pets" p2
         WHERE p2."userId" = l."userId" AND p2."tenant_id" = l."tenant_id") = 1;

-- (c) 그래도 남은 행은 귀속을 확정할 수 없다. NOT NULL 을 걸면 마이그레이션이 실패하므로,
--     "미귀속" 표식이 붙은 자리표시자 아이로 옮겨 **원장을 잃지 않고** 사람이 나중에 정리하게
--     한다. 돈 기록이라 조용히 지우면 안 된다.
INSERT INTO "pets" ("id", "tenant_id", "name", "species", "status", "photo_consent",
                    "schedule_days", "created_at", "updated_at")
SELECT DISTINCT
       '00000000-0000-4000-8000-' || substr(replace(l."tenant_id"::text, '-', ''), 1, 12),
       l."tenant_id", '[미귀속 이용권]', 'DOG', 'INACTIVE', 'PRIVATE',
       '{}'::integer[], now(), now()
  FROM "subscription_ledgers" l
 WHERE l."pet_id" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "subscription_ledgers" l
   SET "pet_id" = '00000000-0000-4000-8000-' || substr(replace(l."tenant_id"::text, '-', ''), 1, 12)
 WHERE l."pet_id" IS NULL;

-- ── 3. 제약 확정 ─────────────────────────────────────────────────────────────
ALTER TABLE "subscription_ledgers" ALTER COLUMN "pet_id" SET NOT NULL;
ALTER TABLE "subscription_ledgers"
  ADD CONSTRAINT "subscription_ledgers_pet_id_fkey"
  FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- userId 는 감사 정보로 강등 — 계정 없는 원생의 내역도 남아야 하므로 nullable.
-- 회원이 탈퇴해도 매장의 돈 기록은 지워지면 안 되므로 Cascade 가 아니라 SetNull 이다.
ALTER TABLE "subscription_ledgers" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "subscription_ledgers" DROP CONSTRAINT IF EXISTS "subscription_ledgers_userId_fkey";
ALTER TABLE "subscription_ledgers"
  ADD CONSTRAINT "subscription_ledgers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 잔액 계산이 "이 아이의 마지막 원장 1건"을 읽는다.
CREATE INDEX "subscription_ledgers_pet_id_created_at_idx"
  ON "subscription_ledgers"("pet_id", "created_at");
