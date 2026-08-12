-- Pet 요일별 등원 스케줄 (0=일 ~ 6=토), "오늘의 출석부" 자동 생성 기준
ALTER TABLE "pets" ADD COLUMN "schedule_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- 하루에 펫당 출석 기록 1건만 존재하도록 보장 (오늘의 출석부 자동 생성 시 중복 방지)
-- 실제 컬럼명은 "petId" (camelCase, schema.prisma 에 @map 없음) — snake_case "pet_id" 는 존재하지 않는 컬럼이므로 오류
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_pet_id_date_key" UNIQUE ("petId", "date");
