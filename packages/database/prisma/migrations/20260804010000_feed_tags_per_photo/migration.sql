-- job-034 후속: 피드 태그를 **게시물 단위 → 사진 단위**로 내린다.
--
-- 왜 바꾸는가: 태그가 게시물에 붙어 있으면 사진 12장을 한 번에 올릴 때 12장 전부가 태그된 모든
-- 아이에게 간다. 그러면 (1) "사진 12장이면 원생 20마리가 다 채워진다"는 계산이 성립하지 않고
-- — 그룹마다 게시물을 따로 만들어야 하므로 — (2) 초코만 나온 사진이 두부 보호자의 알림장에
-- 들어가는 오배포가 생긴다. 초상권 동의를 처음부터 설계한 취지와 정면으로 어긋난다.
--
-- media_id 를 nullable 로 두지 않는 이유: "게시물 전체 태그"와 "사진별 태그"가 공존하면 집계가
-- 두 갈래로 갈리고, Postgres 의 유니크 인덱스는 NULL 을 서로 다른 값으로 취급해서
-- (post_id, NULL, pet_id) 중복을 막아주지도 못한다.

-- ── 1. 컬럼 추가 (기존 로우를 옮기는 동안만 nullable) ────────────────────────
ALTER TABLE "feed_tags" ADD COLUMN "media_id" TEXT;

-- 옛 유니크 (post_id, pet_id) 를 **백필보다 먼저** 없앤다. 한 게시물의 사진 N장으로 펼치면
-- 같은 (post_id, pet_id) 가 N개 생기므로, 이 순서가 아니면 백필 INSERT 자체가 실패한다.
DROP INDEX IF EXISTS "feed_tags_post_id_pet_id_key";

-- ── 2. 기존 게시물 단위 태그를 그 게시물의 사진 전부로 펼친다 ────────────────
-- 지금까지의 의미가 정확히 "이 게시물의 모든 사진에 이 아이가 있다"였으므로, 그 의미를
-- 그대로 보존하는 유일한 변환이다. 첫 사진은 기존 로우를 재사용하고 나머지는 복제한다.
INSERT INTO "feed_tags"
  ("id", "tenant_id", "post_id", "media_id", "pet_id", "source", "confidence", "confirmed", "created_at")
SELECT
  gen_random_uuid()::text,
  t."tenant_id", t."post_id", m."id", t."pet_id",
  t."source", t."confidence", t."confirmed", t."created_at"
FROM "feed_tags" t
JOIN "feed_media" m ON m."post_id" = t."post_id"
WHERE t."media_id" IS NULL
  AND m."id" <> (
    SELECT m2."id" FROM "feed_media" m2
    WHERE m2."post_id" = t."post_id"
    ORDER BY m2."order", m2."id"
    LIMIT 1
  );

UPDATE "feed_tags" t
SET "media_id" = (
  SELECT m2."id" FROM "feed_media" m2
  WHERE m2."post_id" = t."post_id"
  ORDER BY m2."order", m2."id"
  LIMIT 1
)
WHERE t."media_id" IS NULL;

-- 사진이 한 장도 없는 게시물의 태그는 이제 존재할 수 없다(앱에서 사진 1장 이상을 강제하지만
-- 과거 데이터 방어). 붙일 곳이 없으므로 버린다.
DELETE FROM "feed_tags" WHERE "media_id" IS NULL;

-- ── 3. 제약 재편 ────────────────────────────────────────────────────────────
ALTER TABLE "feed_tags" ALTER COLUMN "media_id" SET NOT NULL;

-- 같은 아이가 같은 **사진**에 두 번 태그되지 않게 한다 (기존엔 게시물 기준이었다).
CREATE UNIQUE INDEX "feed_tags_media_id_pet_id_key" ON "feed_tags" ("media_id", "pet_id");

-- post_id 는 이제 유니크의 일부가 아니므로 목록 질의를 위한 인덱스가 따로 필요하다.
CREATE INDEX "feed_tags_post_id_idx" ON "feed_tags" ("post_id");

ALTER TABLE "feed_tags"
  ADD CONSTRAINT "feed_tags_media_id_fkey"
  FOREIGN KEY ("media_id") REFERENCES "feed_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
