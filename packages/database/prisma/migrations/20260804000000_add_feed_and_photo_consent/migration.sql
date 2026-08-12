-- job-034: 피드(사진 기록) 도메인 신설 + 펫 초상권 동의 범위.
--
-- 기존 daily_reports 는 "아이 1명 = 리포트 1건" 구조라 원생 20마리면 20건을 써야 한다.
-- feed_posts 는 사진 1장에 여러 아이를 태그해 **게시물 1건이 여러 보호자에게 팬아웃**되는 구조로,
-- 선생님의 작성 횟수를 원생 수가 아니라 사진 장수에 비례하게 만든다.
--
-- daily_reports 를 대체하지 않는다 — 저녁에 FeedDigestService 가 아이별로 그날의 태그를 모아
-- daily_reports 를 자동 생성하므로, 리포트는 그대로 남고 **입력 방식만 바뀐다**.

-- ── 1. 펫 초상권 동의 범위 ───────────────────────────────────────────────────
-- 단체 사진에 남의 아이가 함께 찍히는 구조라 "누구까지 볼 수 있는가"가 아이별로 필요하다.
--   PRIVATE  본인 보호자만 | CLASS 같은 원 보호자들(기본) | PUBLIC 유치원 전체 + 마케팅
-- 기존 원생은 합사해서 노는 것이 유치원의 기본 운영 형태이므로 CLASS 로 백필된다.
ALTER TABLE "pets" ADD COLUMN "photo_consent" TEXT NOT NULL DEFAULT 'CLASS';

-- ── 2. feed_posts ────────────────────────────────────────────────────────────
CREATE TABLE "feed_posts" (
  "id"               TEXT NOT NULL,
  "tenant_id"        UUID NOT NULL,
  "author_id"        TEXT,
  "date"             DATE NOT NULL,
  "caption"          TEXT,
  "ai_caption_draft" TEXT,
  "status"           TEXT NOT NULL DEFAULT 'DRAFT',
  "published_at"     TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- 커버리지("오늘 사진 0장인 아이")와 하루 마감이 모두 (테넌트, 날짜)로 훑는다.
CREATE INDEX "feed_posts_tenant_id_date_idx"   ON "feed_posts" ("tenant_id", "date");
CREATE INDEX "feed_posts_tenant_id_status_idx" ON "feed_posts" ("tenant_id", "status");

ALTER TABLE "feed_posts"
  ADD CONSTRAINT "feed_posts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- 올린 선생님이 퇴사(계정 삭제)해도 아이 사진은 남아야 한다.
ALTER TABLE "feed_posts"
  ADD CONSTRAINT "feed_posts_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. feed_media ────────────────────────────────────────────────────────────
CREATE TABLE "feed_media" (
  "id"         TEXT NOT NULL,
  "tenant_id"  UUID NOT NULL,
  "post_id"    TEXT NOT NULL,
  "file_id"    TEXT NOT NULL,
  "type"       TEXT NOT NULL DEFAULT 'IMAGE',
  "order"      INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feed_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feed_media_post_id_idx"   ON "feed_media" ("post_id");
CREATE INDEX "feed_media_tenant_id_idx" ON "feed_media" ("tenant_id");

ALTER TABLE "feed_media"
  ADD CONSTRAINT "feed_media_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_media"
  ADD CONSTRAINT "feed_media_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_media"
  ADD CONSTRAINT "feed_media_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. feed_tags ─────────────────────────────────────────────────────────────
-- 팬아웃의 유일한 근거이자 출석부의 원천(태그된 아이 = 오늘 등원한 아이).
CREATE TABLE "feed_tags" (
  "id"         TEXT NOT NULL,
  "tenant_id"  UUID NOT NULL,
  "post_id"    TEXT NOT NULL,
  "pet_id"     TEXT NOT NULL,
  "source"     TEXT NOT NULL DEFAULT 'MANUAL',
  "confidence" DOUBLE PRECISION,
  "confirmed"  BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feed_tags_pkey" PRIMARY KEY ("id")
);

-- 같은 게시물에 같은 아이가 두 번 태그되지 않게 한다(AI 제안 + 수동 추가가 겹칠 수 있다).
CREATE UNIQUE INDEX "feed_tags_post_id_pet_id_key" ON "feed_tags" ("post_id", "pet_id");
CREATE INDEX "feed_tags_pet_id_idx"    ON "feed_tags" ("pet_id");
CREATE INDEX "feed_tags_tenant_id_idx" ON "feed_tags" ("tenant_id");

ALTER TABLE "feed_tags"
  ADD CONSTRAINT "feed_tags_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_tags"
  ADD CONSTRAINT "feed_tags_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_tags"
  ADD CONSTRAINT "feed_tags_pet_id_fkey"
  FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. feed_tag_corrections ──────────────────────────────────────────────────
-- AI 태그 제안에 대한 사람의 수정 이력. "오인식 수정이 곧 학습 데이터"라는 자산 논리라
-- 태그가 지워진 뒤에도 남아야 하므로 feed_tags 가 아니라 pet_id 를 직접 들고 있다(FK 아님).
CREATE TABLE "feed_tag_corrections" (
  "id"           TEXT NOT NULL,
  "tenant_id"    UUID NOT NULL,
  "post_id"      TEXT NOT NULL,
  "pet_id"       TEXT NOT NULL,
  "action"       TEXT NOT NULL,
  "confidence"   DOUBLE PRECISION,
  "corrected_by" TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feed_tag_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feed_tag_corrections_tenant_id_created_at_idx"
  ON "feed_tag_corrections" ("tenant_id", "created_at");
CREATE INDEX "feed_tag_corrections_pet_id_idx" ON "feed_tag_corrections" ("pet_id");

ALTER TABLE "feed_tag_corrections"
  ADD CONSTRAINT "feed_tag_corrections_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_tag_corrections"
  ADD CONSTRAINT "feed_tag_corrections_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
-- tenant_id 가 NOT NULL 인 순수 테넌트 데이터이므로 attendances/daily_reports 와 같은 정책을 쓴다.
-- 보호자의 "내 아이 피드"는 여러 매장을 가로지를 수 있어 runWithoutTenant + pet.userId 필터로
-- 조회하며, 그 경로의 실제 격리는 pets 와 마찬가지로 Prisma Extension 이 담당한다
-- (docs/multi-tenant-migration-plan.md — 앱이 DB 슈퍼유저로 접속하는 동안 RLS 는 이중 방어선이다).
ALTER TABLE "feed_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_posts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "feed_posts"
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "feed_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_media" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "feed_media"
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "feed_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "feed_tags"
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "feed_tag_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_tag_corrections" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "feed_tag_corrections"
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
