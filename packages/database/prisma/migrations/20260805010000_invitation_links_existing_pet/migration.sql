-- job-040: 초대장이 **이미 생성된 원생**을 가리킬 수 있게 한다.
--
-- 배경: 앞 마이그레이션으로 pets.userId 가 nullable 이 되면서, 매장은 보호자의 가입을
-- 기다리지 않고 전화번호만으로 원생을 등록할 수 있게 됐다. 그 순간 Pet 로우가 먼저 생기고,
-- 같은 전화번호로 TenantInvitation 도 함께 남는다(나중에 가입하면 자동 연결하기 위해).
--
-- 그런데 기존 수락 경로(InvitationService.attachWithPet)는 invitation.pet_name 이 있으면
-- **Pet 을 새로 만든다.** 그대로 두면 보호자가 가입하는 순간 같은 아이가 두 마리로 갈라지고,
-- 그때까지 쌓인 출석·알림장·사진은 전부 보호자에게 안 보이는 쪽(userId = null)에 남는다.
-- 눈에 띄는 건 보호자가 "우리 애 기록이 하나도 없어요"라고 문의할 때다.
--
-- 그래서 초대장이 어떤 펫에서 비롯됐는지를 명시한다. pet_id 가 있으면 새로 만들지 않고
-- 그 펫에 userId 를 채운다(= 계정 연결). 없으면 기존 선등록 정보로 생성한다(job-034 경로).

-- ON DELETE SET NULL: 매장이 원생을 지워도 초대장 자체는 감사 기록으로 남긴다.
-- (누가 언제 누구를 초대했는지는 펫의 생사와 별개로 보존되어야 한다)
ALTER TABLE "tenant_invitations" ADD COLUMN "pet_id" TEXT;

ALTER TABLE "tenant_invitations"
  ADD CONSTRAINT "tenant_invitations_pet_id_fkey"
  FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
