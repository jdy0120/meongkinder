import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import type { CreateTenantClosureRequest } from "@pawlog/shared";

/** `"YYYY-MM"` — 설정 화면이 보고 있는 달. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** `"YYYY-MM-DD"` — 로컬 날짜. `Date` 로 받으면 UTC 변환으로 하루가 밀린다. */
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class TenantClosureQueryDto {
  @ApiPropertyOptional({
    description:
      "조회할 달 (YYYY-MM). 미지정 시 오늘 이후의 휴무일 전체를 내려준다.",
    example: "2026-08",
  })
  @IsOptional()
  @Matches(MONTH_PATTERN, { message: "month 는 YYYY-MM 형식이어야 합니다." })
  month?: string;
}

/** 임시 휴무일 등록 (job-060). */
export class CreateTenantClosureDto implements CreateTenantClosureRequest {
  @ApiProperty({ description: "쉬는 날 (YYYY-MM-DD)", example: "2026-09-16" })
  @Matches(DATE_PATTERN, { message: "date 는 YYYY-MM-DD 형식이어야 합니다." })
  date!: string;

  /**
   * 사유는 **보호자에게 그대로 보인다.** 달력에서 잠긴 날을 눌렀을 때 "휴무"만 뜨면
   * 보호자는 매장에 전화하지만, "설 연휴"·"정기 소독"이면 전화가 필요 없다.
   */
  @ApiPropertyOptional({
    description: "사유 (보호자에게 공개)",
    example: "설 연휴",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reason?: string;
}
