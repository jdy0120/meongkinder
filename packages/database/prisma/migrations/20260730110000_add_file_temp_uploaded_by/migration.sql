-- AlterTable: FileTemp 도 File 과 동일하게 업로드 주체(uploadedBy)를 추적한다.
ALTER TABLE "file_temps"
  ADD COLUMN "uploadedBy" TEXT;
