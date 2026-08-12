-- job-047: 매장 대표 연락처.
--
-- 알림톡을 받은 미가입 보호자가 여는 유일한 화면(공개 알림장 `/r/<token>`)에 매장에
-- 물어볼 방법이 없었다. 그 사람은 계정도 앱도 없어서, 화면을 벗어나면 되돌아올 길이 없다.
-- 저장은 숫자만 한다(job-043 규칙).
ALTER TABLE "tenants" ADD COLUMN "contact_phone" TEXT;
