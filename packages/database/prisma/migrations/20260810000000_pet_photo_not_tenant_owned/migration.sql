-- job-055: 펫 프로필 사진은 테넌트 소유가 아니다.
--
-- 스키마 변경은 없다 — `files.tenant_id` 는 이미 nullable 이다. 고치는 것은 **데이터**다.
--
-- 파일의 테넌트는 업로드한 요청의 스코프로 정해지는데, 그 파일이 보이는 범위는 붙어 있는
-- 엔티티의 테넌트가 정한다. 펫은 그 둘이 어긋나는 유일한 엔티티다: 보호자가 개인 스코프
-- (`POST v1/pets`)에서 사진과 함께 아이를 등록하면 파일이 테넌트 없이(= seed 의 default
-- 테넌트로) 찍히고, 나중에 원장이 그 아이를 원생으로 받으면 펫의 tenant_id 만 매장으로
-- 바뀐다. 그러면 매장 화면에서 `GET v1/file/:id` 가 Prisma Extension 의 스코프 주입에
-- 걸려 404 가 되고, 아바타만 깨진 채 남는다 — 파일은 디스크에 멀쩡히 있는데도.
--
-- 앞으로는 `FileService` 가 펫 사진을 ownership: "shared"(tenant_id = NULL)로 승격한다.
-- 여기서는 그 이전에 만들어진 기존 행을 같은 상태로 맞춘다.
--
-- ⚠️ `local_path` 는 건드리지 않는다. 경로에 박힌 테넌트 디렉터리는 이제 의미가 없지만,
--    DB 의 local_path 가 실제 위치의 유일한 출처라 그대로 두면 계속 정상적으로 열린다.
--    (새로 올라오는 사진만 `resources/uploads/_shared/...` 로 들어간다.)
UPDATE "files"
SET "tenant_id" = NULL
WHERE "id" IN (
  SELECT "profile_image_file_id"
  FROM "pets"
  WHERE "profile_image_file_id" IS NOT NULL
);
