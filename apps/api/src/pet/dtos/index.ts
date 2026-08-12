import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import {
  PHOTO_CONSENTS,
  PICKUP_METHODS,
  SCHEDULE_TYPES,
  VACCINATION_TYPES,
} from "@pawlog/shared";
import type {
  CreatePetRequest,
  EnrollPetRequest,
  PickupAuthorizedPerson,
  UpdatePetRequest,
  VaccinationRecord,
} from "@pawlog/shared";

// 초상권 동의 범위 필드는 등록/수정 DTO 가 동일하므로 설명을 한 곳에서 관리한다.
const PHOTO_CONSENT_DESCRIPTION =
  "초상권 동의 범위 (PRIVATE 본인 보호자만 | CLASS 같은 원 보호자들(기본) | PUBLIC 유치원 전체+마케팅)";

// 안전/픽업 필드도 등록·수정이 같으므로 설명을 한 곳에서 관리한다 (job-052).
const TEMPERAMENTS_DESCRIPTION =
  "성향. **형용사가 아니라 상황 서술**로 적는다 ('소심함' ✗ / '대형견 무서워함' ○) — 훈련사가 합사 그룹을 나눌 때 그대로 쓸 수 있어야 한다";
const PICKUP_TIME_DESCRIPTION =
  "픽업 예정 시각 'HH:mm' (KST). 원생 목록의 기본 정렬 키다";

/** "HH:mm" 24시간 표기. 초·오전오후 표기를 섞으면 정렬이 문자열로 깨진다. */
const PICKUP_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class VaccinationRecordDto implements VaccinationRecord {
  @ApiProperty({
    description: "백신 종류",
    enum: VACCINATION_TYPES,
  })
  @IsIn(VACCINATION_TYPES)
  type!: string;

  @ApiProperty({ description: "만료일 (ISO 8601)" })
  @IsISO8601()
  expiresAt!: string;
}

export class PickupAuthorizedPersonDto implements PickupAuthorizedPerson {
  @ApiProperty({ description: "이름" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "연락처" })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ description: "관계 (예: 아빠, 이모, 조부모)" })
  @IsOptional()
  @IsString()
  relation?: string;
}

export class CreatePetDto implements CreatePetRequest {
  @ApiProperty({ description: "이름" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "종 (예: DOG, CAT)" })
  @IsString()
  @IsNotEmpty()
  species!: string;

  @ApiPropertyOptional({ description: "품종" })
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({ description: "생년월일 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @ApiPropertyOptional({ description: "성별 (MALE | FEMALE)" })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: "중성화 여부" })
  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean;

  @ApiPropertyOptional({ description: "체중(kg)" })
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ description: "프로필 이미지 파일 ID" })
  @IsOptional()
  @IsString()
  profileImageFileId?: string;

  @ApiPropertyOptional({
    description:
      "자유 서술 케어 노트. 알러지·성향·마킹·접종은 **아래 구조화 필드**에 넣는다 — 여기 문장으로 두면 카드 표면에 올릴 수도, 필터를 걸 수도 없다 (job-052)",
  })
  @IsOptional()
  @IsString()
  careNote?: string;

  // ── 안전 정보 (job-052) ────────────────────────────────────────────────
  @ApiPropertyOptional({ description: "알러지 (예: 닭고기)", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional({
    description: TEMPERAMENTS_DESCRIPTION,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  temperaments?: string[];

  @ApiPropertyOptional({ description: "실내 마킹 여부" })
  @IsOptional()
  @IsBoolean()
  marksIndoors?: boolean;

  @ApiPropertyOptional({ description: "마운팅 여부" })
  @IsOptional()
  @IsBoolean()
  mountingBehavior?: boolean;

  @ApiPropertyOptional({
    description:
      "공격/입질 이력. 이것만 긴급도가 critical 이라 원생 카드 테두리를 승격시킨다",
  })
  @IsOptional()
  @IsBoolean()
  hasBiteHistory?: boolean;

  @ApiPropertyOptional({
    description:
      "예방접종 기록. 만료/임박(D-14) 판정은 저장하지 않고 조회 시점에 계산한다",
    type: [VaccinationRecordDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaccinationRecordDto)
  vaccinations?: VaccinationRecordDto[];

  @ApiPropertyOptional({
    description: "적응 기간 시작일 (ISO 8601). 있으면 '적응 N일차'를 계산한다",
  })
  @IsOptional()
  @IsISO8601()
  adaptationStartedAt?: string;

  // ── 픽업 (job-052) ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: PICKUP_TIME_DESCRIPTION })
  @IsOptional()
  @Matches(PICKUP_TIME_PATTERN, {
    message: "pickupTime 은 'HH:mm' 24시간 표기여야 합니다",
  })
  pickupTime?: string;

  @ApiPropertyOptional({
    description: "픽업 수단",
    enum: PICKUP_METHODS,
  })
  @IsOptional()
  @IsIn(PICKUP_METHODS)
  pickupMethod?: string;

  @ApiPropertyOptional({ description: "셔틀 호차 (픽업 수단이 SHUTTLE 일 때)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  shuttleNumber?: number;

  @ApiPropertyOptional({ description: "보호자 이름" })
  @IsOptional()
  @IsString()
  guardianName?: string;

  @ApiPropertyOptional({ description: "보호자 연락처" })
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @ApiPropertyOptional({ description: "비상 연락처 이름" })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ description: "비상 연락처 전화번호" })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    description: "픽업 권한자 목록",
    type: [PickupAuthorizedPersonDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickupAuthorizedPersonDto)
  pickupAuthorizedPersons?: PickupAuthorizedPersonDto[];

  @ApiPropertyOptional({
    description:
      "등원 스케줄 방식 (WEEKLY = 매주 반복 | MONTHLY = 날짜 지정). 날짜 자체는 " +
      "`PUT v1/admin/pets/:id/schedule` 로 달 단위로 저장한다.",
    enum: SCHEDULE_TYPES,
  })
  @IsOptional()
  @IsIn(SCHEDULE_TYPES)
  scheduleType?: string;

  @ApiPropertyOptional({
    description:
      "요일별 등원 스케줄 (0=일 ~ 6=토). scheduleType 이 WEEKLY 일 때만 읽는다",
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduleDays?: number[];

  @ApiPropertyOptional({
    description: PHOTO_CONSENT_DESCRIPTION,
    enum: PHOTO_CONSENTS,
  })
  @IsOptional()
  @IsIn(PHOTO_CONSENTS)
  photoConsent?: string;
}

export class UpdatePetDto implements UpdatePetRequest {
  @ApiPropertyOptional({ description: "이름" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "종 (예: DOG, CAT)" })
  @IsOptional()
  @IsString()
  species?: string;

  @ApiPropertyOptional({ description: "품종" })
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({ description: "생년월일 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @ApiPropertyOptional({ description: "성별 (MALE | FEMALE)" })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: "중성화 여부" })
  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean;

  @ApiPropertyOptional({ description: "체중(kg)" })
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ description: "프로필 이미지 파일 ID" })
  @IsOptional()
  @IsString()
  profileImageFileId?: string;

  @ApiPropertyOptional({
    description:
      "자유 서술 케어 노트. 알러지·성향·마킹·접종은 **아래 구조화 필드**에 넣는다 — 여기 문장으로 두면 카드 표면에 올릴 수도, 필터를 걸 수도 없다 (job-052)",
  })
  @IsOptional()
  @IsString()
  careNote?: string;

  // ── 안전 정보 (job-052) ────────────────────────────────────────────────
  @ApiPropertyOptional({ description: "알러지 (예: 닭고기)", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional({
    description: TEMPERAMENTS_DESCRIPTION,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  temperaments?: string[];

  @ApiPropertyOptional({ description: "실내 마킹 여부" })
  @IsOptional()
  @IsBoolean()
  marksIndoors?: boolean;

  @ApiPropertyOptional({ description: "마운팅 여부" })
  @IsOptional()
  @IsBoolean()
  mountingBehavior?: boolean;

  @ApiPropertyOptional({
    description:
      "공격/입질 이력. 이것만 긴급도가 critical 이라 원생 카드 테두리를 승격시킨다",
  })
  @IsOptional()
  @IsBoolean()
  hasBiteHistory?: boolean;

  @ApiPropertyOptional({
    description:
      "예방접종 기록. 만료/임박(D-14) 판정은 저장하지 않고 조회 시점에 계산한다",
    type: [VaccinationRecordDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaccinationRecordDto)
  vaccinations?: VaccinationRecordDto[];

  @ApiPropertyOptional({
    description: "적응 기간 시작일 (ISO 8601). 있으면 '적응 N일차'를 계산한다",
  })
  @IsOptional()
  @IsISO8601()
  adaptationStartedAt?: string;

  // ── 픽업 (job-052) ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: PICKUP_TIME_DESCRIPTION })
  @IsOptional()
  @Matches(PICKUP_TIME_PATTERN, {
    message: "pickupTime 은 'HH:mm' 24시간 표기여야 합니다",
  })
  pickupTime?: string;

  @ApiPropertyOptional({
    description: "픽업 수단",
    enum: PICKUP_METHODS,
  })
  @IsOptional()
  @IsIn(PICKUP_METHODS)
  pickupMethod?: string;

  @ApiPropertyOptional({ description: "셔틀 호차 (픽업 수단이 SHUTTLE 일 때)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  shuttleNumber?: number;

  @ApiPropertyOptional({ description: "보호자 이름" })
  @IsOptional()
  @IsString()
  guardianName?: string;

  @ApiPropertyOptional({ description: "보호자 연락처" })
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @ApiPropertyOptional({ description: "비상 연락처 이름" })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ description: "비상 연락처 전화번호" })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    description: "픽업 권한자 목록",
    type: [PickupAuthorizedPersonDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickupAuthorizedPersonDto)
  pickupAuthorizedPersons?: PickupAuthorizedPersonDto[];

  @ApiPropertyOptional({
    description:
      "등원 스케줄 방식 (WEEKLY = 매주 반복 | MONTHLY = 날짜 지정). 날짜 자체는 " +
      "`PUT v1/admin/pets/:id/schedule` 로 달 단위로 저장한다.",
    enum: SCHEDULE_TYPES,
  })
  @IsOptional()
  @IsIn(SCHEDULE_TYPES)
  scheduleType?: string;

  @ApiPropertyOptional({
    description:
      "요일별 등원 스케줄 (0=일 ~ 6=토). scheduleType 이 WEEKLY 일 때만 읽는다",
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduleDays?: number[];

  @ApiPropertyOptional({
    description: PHOTO_CONSENT_DESCRIPTION,
    enum: PHOTO_CONSENTS,
  })
  @IsOptional()
  @IsIn(PHOTO_CONSENTS)
  photoConsent?: string;
}

/** 등원 — 내 펫을 소속된 매장의 원생으로 등록한다 (job-033). */
export class EnrollPetDto implements EnrollPetRequest {
  @ApiProperty({ description: "등록할 매장(테넌트) ID" })
  @IsString()
  @IsNotEmpty()
  tenantId: string;
}
