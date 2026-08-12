-- job-034: 회원 휴대폰 번호.
--
-- 유치원이 아직 가입하지 않은 보호자를 전화번호로 초대(TenantInvitation)해 두면,
-- 그 번호로 가입하는 순간 초대와 자동 매칭되어야 한다. 매칭 조회 경로라 인덱스가 필요하다.
--
-- 유니크는 아직 걸지 않는다 — 기존 계정에는 번호가 없고, 본인인증(OTP) 절차도 없어
-- 같은 번호가 중복 입력될 수 있기 때문. 본인인증이 붙는 시점에 UNIQUE 전환을 검토한다.
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
CREATE INDEX "users_phone_idx" ON "users" ("phone");
