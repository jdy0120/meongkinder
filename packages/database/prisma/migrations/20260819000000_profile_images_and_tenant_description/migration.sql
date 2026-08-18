-- job-063: 회원 프로필 사진 · 매장 대표 이미지 · 매장 소개.
--
-- 셋 다 nullable 이다. 이미 만들어진 계정과 매장이 이 값 없이 존재하고, 없어도 운영에는
-- 아무 문제가 없어야 한다 — 화면이 이니셜/기본 아이콘으로 대신한다.
--
-- ⚠️ 이미지 컬럼은 `File.id` 를 담지만 **FK 를 걸지 않는다.** `pets.profile_image_file_id`
-- 와 같은 규칙이다. 파일 정리 배치가 파일을 지울 때 회원·매장 행까지 잠기면 안 되고,
-- 끊긴 참조는 화면이 폴백으로 처리한다.
--
-- ⚠️ 두 이미지 모두 저장 시 `FileOwnership.shared`(tenant_id = NULL)로 승격된다(job-055).
--    · 회원 사진: 회원은 여러 매장에 걸치거나 아무 데도 속하지 않는다.
--    · 매장 이미지: 공개 매장 찾기와 공개 알림장(`/r/<token>`)은 로그인도 테넌트 컨텍스트도
--      없이 열리는데, `assertReadable` 은 tenant_id = NULL 인 파일만 그 스코프에서 열어 준다.
--      테넌트 소유로 두면 정작 보여줘야 할 화면에서 403 이 난다.
ALTER TABLE "users" ADD COLUMN "profile_image_file_id" TEXT;

ALTER TABLE "tenants" ADD COLUMN "profile_image_file_id" TEXT;
ALTER TABLE "tenants" ADD COLUMN "description" TEXT;
