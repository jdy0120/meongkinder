-- RenameColumn (memo -> care_note: 케어 노트로 의미 명확화)
ALTER TABLE "pets" RENAME COLUMN "memo" TO "care_note";

-- AlterTable: 보호자/비상 연락처, 픽업 권한자 추가
ALTER TABLE "pets"
  ADD COLUMN "guardian_name" TEXT,
  ADD COLUMN "guardian_phone" TEXT,
  ADD COLUMN "emergency_contact_name" TEXT,
  ADD COLUMN "emergency_contact_phone" TEXT,
  ADD COLUMN "pickup_authorized_persons" JSONB;
