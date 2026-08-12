import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type {
  CreateAttendanceRequest,
  UpdateAttendanceRequest,
  CheckInAttendanceRequest,
  CheckOutAttendanceRequest,
  UpdateAttendanceStatusRequest,
  CreateDailyReportRequest,
  UpdateDailyReportRequest,
  CreateReportContentRequest,
  UpdateReportContentRequest,
} from "@pawlog/shared";
import { PaginationQueryDto } from "../../shared/dtos";

/**
 * 보호자용 일일 리포트 목록 조회 쿼리.
 * 전역 ValidationPipe 가 whitelist 를 강제하므로 petId/date 필터는
 * PaginationQueryDto 를 상속한 전용 DTO로 선언해야 400 오류가 나지 않는다.
 */
export class DailyReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "반려동물 ID로 필터링" })
  @IsOptional()
  @IsString()
  petId?: string;

  @ApiPropertyOptional({ description: "리포트 대상 일자로 필터링 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  date?: string;
}

/**
 * 공개 알림장 조회 쿼리 (job-040).
 * 토큰 자체가 열쇠이므로 다른 필터는 받지 않는다 — 링크 하나 = 알림장 하나.
 */
export class SharedReportQueryDto {
  @ApiProperty({ description: "알림톡 링크에 담긴 서명 토큰" })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

/**
 * 출석 목록 조회 쿼리 (job-046).
 * 전역 ValidationPipe 가 whitelist 를 강제하므로 petId 필터는 PaginationQueryDto 를
 * 상속한 전용 DTO 로 선언해야 400 이 나지 않는다.
 */
export class AttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "반려동물 ID로 필터링" })
  @IsOptional()
  @IsString()
  petId?: string;
}

export class CreateAttendanceDto implements CreateAttendanceRequest {
  @ApiProperty({ description: "반려동물 ID" })
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @ApiProperty({ description: "출석 대상 일자 (ISO 8601)" })
  @IsISO8601()
  date!: string;

  @ApiPropertyOptional({
    description:
      "출석 상태 (SCHEDULED | CHECKED_IN | CHECKED_OUT | ABSENT | CANCELED)",
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateAttendanceDto implements UpdateAttendanceRequest {
  @ApiPropertyOptional({ description: "출석 대상 일자 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({
    description:
      "출석 상태 (SCHEDULED | CHECKED_IN | CHECKED_OUT | ABSENT | CANCELED)",
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "등원 시각 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  checkInAt?: string;

  @ApiPropertyOptional({ description: "하원 시각 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  checkOutAt?: string;
}

export class CheckInAttendanceDto implements CheckInAttendanceRequest {
  @ApiPropertyOptional({
    description: "등원 시각 (ISO 8601, 미지정 시 현재 시각)",
  })
  @IsOptional()
  @IsISO8601()
  checkInAt?: string;

  @ApiPropertyOptional({
    description: "정기권/회수권 차감 여부 (기본 true)",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  deductSubscription?: boolean;
}

export class CheckOutAttendanceDto implements CheckOutAttendanceRequest {
  @ApiPropertyOptional({
    description: "하원 시각 (ISO 8601, 미지정 시 현재 시각)",
  })
  @IsOptional()
  @IsISO8601()
  checkOutAt?: string;

  @ApiPropertyOptional({
    description: "정기권/회수권 차감 여부 (기본 false)",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  deductSubscription?: boolean;
}

export class UpdateAttendanceStatusDto implements UpdateAttendanceStatusRequest {
  @ApiProperty({ description: "출석 상태 (ABSENT | MAKEUP | CANCELED)" })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiPropertyOptional({ description: "정기권/회수권 차감 여부" })
  @IsOptional()
  @IsBoolean()
  deductSubscription?: boolean;

  @ApiPropertyOptional({ description: "결석/보강 사유" })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateReportContentDto implements CreateReportContentRequest {
  @ApiProperty({
    description:
      "항목 구분 (MEAL 식사 | TOILET 배변 | NAP 낮잠 | ACTIVITY 활동 | HEALTH 건강 | NOTE 특이사항 | PHOTO 사진)",
  })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({ description: "제목" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: "내용" })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: "첨부 파일 ID (v1/file 업로드 응답의 File.id)",
  })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiPropertyOptional({ description: "노출 순서" })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateReportContentDto implements UpdateReportContentRequest {
  @ApiPropertyOptional({
    description:
      "항목 구분 (MEAL 식사 | TOILET 배변 | NAP 낮잠 | ACTIVITY 활동 | HEALTH 건강 | NOTE 특이사항 | PHOTO 사진)",
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: "제목" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: "내용" })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: "첨부 파일 ID (v1/file 업로드 응답의 File.id)",
  })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiPropertyOptional({ description: "노출 순서" })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class CreateDailyReportDto implements CreateDailyReportRequest {
  @ApiProperty({ description: "반려동물 ID (아이 태그)" })
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @ApiPropertyOptional({ description: "연동된 출석 기록 ID" })
  @IsOptional()
  @IsString()
  attendanceId?: string;

  @ApiProperty({ description: "리포트 대상 일자 (ISO 8601)" })
  @IsISO8601()
  date!: string;

  @ApiPropertyOptional({ description: "총평/한줄 요약" })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: "상태 (DRAFT | PUBLISHED)" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      "리포트 항목 목록 (식사/배변/낮잠/활동/특이사항/사진 일괄 입력, 사진은 여러 장의 PHOTO 타입 항목으로 전달)",
    type: [CreateReportContentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReportContentDto)
  contents?: CreateReportContentDto[];
}

export class UpdateDailyReportDto implements UpdateDailyReportRequest {
  @ApiPropertyOptional({ description: "연동된 출석 기록 ID" })
  @IsOptional()
  @IsString()
  attendanceId?: string;

  @ApiPropertyOptional({ description: "리포트 대상 일자 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ description: "총평/한줄 요약" })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: "상태 (DRAFT | PUBLISHED)" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      "리포트 항목 목록 (전달 시 기존 항목을 대체하며 AI 코멘트 초안을 재생성)",
    type: [CreateReportContentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReportContentDto)
  contents?: CreateReportContentDto[];
}
