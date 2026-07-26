import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import type {
  CreateAttendanceRequest,
  UpdateAttendanceRequest,
  CreateDailyReportRequest,
  UpdateDailyReportRequest,
  CreateReportContentRequest,
  UpdateReportContentRequest,
} from "@pawlog/shared";

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

export class CreateDailyReportDto implements CreateDailyReportRequest {
  @ApiProperty({ description: "반려동물 ID" })
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
}

export class CreateReportContentDto implements CreateReportContentRequest {
  @ApiProperty({
    description: "항목 구분 (MEAL | ACTIVITY | HEALTH | NOTE | PHOTO)",
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

  @ApiPropertyOptional({ description: "첨부 파일 ID" })
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
    description: "항목 구분 (MEAL | ACTIVITY | HEALTH | NOTE | PHOTO)",
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

  @ApiPropertyOptional({ description: "첨부 파일 ID" })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiPropertyOptional({ description: "노출 순서" })
  @IsOptional()
  @IsInt()
  order?: number;
}
