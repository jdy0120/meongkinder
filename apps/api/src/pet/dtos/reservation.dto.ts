import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  Matches,
} from "class-validator";
import type { CreateReservationRequest } from "@pawlog/shared";

/** `"YYYY-MM"` — 달력 화면이 보고 있는 달. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** `"YYYY-MM-DD"` — 로컬 날짜. `Date` 로 받으면 UTC 변환으로 하루가 밀린다. */
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * 한 번에 잡을 수 있는 날짜 수 상한.
 *
 * 실제 한도는 이용권 잔액이라 여기서 막을 일은 거의 없다. 그래도 두는 이유는 잔액
 * 검사 **전에** 날짜별 검사를 돌기 때문 — 상한이 없으면 잔액 0인 사람이 만 건짜리
 * 배열로 그 루프를 돌릴 수 있다.
 */
const MAX_DATES_PER_REQUEST = 62;

export class ReservationCalendarQueryDto {
  @ApiPropertyOptional({
    description: "조회할 달 (YYYY-MM). 미지정 시 이번 달",
    example: "2026-08",
  })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: "month 는 YYYY-MM 형식이어야 합니다." })
  month?: string;
}

/** 등원 예약 추가 (job-060). 하나라도 막히면 전부 거절된다. */
export class CreateReservationDto implements CreateReservationRequest {
  @ApiProperty({
    description: "예약할 날짜 (YYYY-MM-DD)",
    type: [String],
    example: ["2026-08-17", "2026-08-19"],
  })
  @IsArray()
  @ArrayNotEmpty({ message: "예약할 날짜를 선택해주세요." })
  @ArrayMaxSize(MAX_DATES_PER_REQUEST)
  @Matches(DATE_PATTERN, {
    each: true,
    message: "dates 는 YYYY-MM-DD 형식이어야 합니다.",
  })
  dates!: string[];
}
