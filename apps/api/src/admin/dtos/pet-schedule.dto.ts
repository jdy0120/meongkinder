import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from "class-validator";
import { SCHEDULE_TYPES } from "@pawlog/shared";
import type { UpdatePetScheduleRequest } from "@pawlog/shared";

/** `"YYYY-MM"` — 달력 화면이 보고 있는 달. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** `"YYYY-MM-DD"` — 로컬 날짜. `Date` 로 받으면 UTC 변환으로 하루가 밀린다. */
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 한 달은 최대 31일. 이보다 많이 들어오면 그 달의 날짜가 아니다. */
const MAX_DATES_PER_MONTH = 31;

export class PetScheduleQueryDto {
  @ApiPropertyOptional({
    description: "조회할 달 (YYYY-MM). 미지정 시 이번 달",
    example: "2026-08",
  })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: "month 는 YYYY-MM 형식이어야 합니다." })
  month?: string;
}

export class UpdatePetScheduleDto implements UpdatePetScheduleRequest {
  @ApiProperty({
    description: "등원 스케줄 방식",
    enum: SCHEDULE_TYPES,
  })
  @IsIn(SCHEDULE_TYPES)
  scheduleType!: string;

  @ApiPropertyOptional({
    description: "WEEKLY 일 때의 요일 (0=일 ~ 6=토)",
    type: [Number],
    example: [1, 3, 5],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduleDays?: number[];

  @ApiPropertyOptional({
    description: "MONTHLY 일 때 교체 대상 달 (YYYY-MM)",
    example: "2026-08",
  })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: "month 는 YYYY-MM 형식이어야 합니다." })
  month?: string;

  @ApiPropertyOptional({
    description:
      "MONTHLY 일 때 그 달의 등원일 전체 (YYYY-MM-DD). 빈 배열이면 그 달을 비운다.",
    type: [String],
    example: ["2026-08-06", "2026-08-08"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DATES_PER_MONTH)
  @Matches(DATE_PATTERN, {
    each: true,
    message: "dates 는 YYYY-MM-DD 형식이어야 합니다.",
  })
  dates?: string[];
}
