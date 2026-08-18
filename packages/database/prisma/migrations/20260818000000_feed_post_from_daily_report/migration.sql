-- job-062: 알림장에 올린 사진이 피드에도 쌓인다 (미러 게시물).
--
-- 입력구는 피드와 알림장 두 곳 그대로 둔다 — 알림장은 "오늘 사진 안 올린 아이가 누구인지"를
-- 아이 단위로 확인할 수 있는 유일한 축이라 없앨 이유가 없다. 대신 알림장에 올린 사진이
-- 피드에는 존재하지 않던 비대칭을 없앤다. 그동안 그 사진들은 보호자 피드에도 안 뜨고,
-- "오늘 사진 0장" 커버리지 집계에도 잡히지 않아 **선생님이 사진을 올렸는데도 경고가 계속
-- 떠 있었다.**
--
-- ⚠️ UNIQUE 가 이 컬럼의 핵심이다. 알림장 수정은 report_contents 를 통째로 갈아엎으므로
-- (`deleteMany: {}`), 연결 고리가 없으면 알림장을 고칠 때마다 미러 게시물이 하나씩 쌓인다.
--
-- ON DELETE CASCADE 인 이유: 알림장이 지워지면 그 사진이 피드에 남을 근거도 사라진다.
-- 서비스가 지우는 코드를 따로 들고 있으면 삭제 경로가 늘어날 때마다 빠뜨린다.
ALTER TABLE "feed_posts" ADD COLUMN "source_daily_report_id" TEXT;

CREATE UNIQUE INDEX "feed_posts_source_daily_report_id_key"
    ON "feed_posts"("source_daily_report_id");

ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_source_daily_report_id_fkey"
    FOREIGN KEY ("source_daily_report_id") REFERENCES "daily_reports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
