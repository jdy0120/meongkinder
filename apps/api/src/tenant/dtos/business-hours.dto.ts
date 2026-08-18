import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  TIME_PATTERN,
  type BusinessBreak,
  type BusinessDay,
  type BusinessHours,
} from "@pawlog/shared";

/**
 * 매장 운영시간 DTO (job-060).
 *
 * ⚠️ 여기서 보는 것은 **형식뿐**이다(`HH:mm` 인가, 요일이 0~6 인가). 형식은 맞는데 말이
 * 안 되는 조합 — 개점과 마감이 같다, 휴게시간이 영업시간 밖이다, 휴게시간끼리 겹친다 —
 * 은 `validateBusinessHours`(packages/shared)가 서비스에서 본다. 그 판정을 여기 옮기면
 * 화면과 서버가 각자 구현하게 되고, 경계값에서 갈라지면 화면은 "영업 중"이라 하고
 * 서버는 닫혔다고 하는 상태가 된다.
 */
export class BusinessBreakDto implements BusinessBreak {
  @ApiProperty({ description: "휴게 시작 (HH:mm)", example: "13:00" })
  @IsString()
  @Matches(TIME_PATTERN, {
    message: "휴게 시작 시각의 형식이 올바르지 않습니다.",
  })
  start!: string;

  @ApiProperty({ description: "휴게 종료 (HH:mm)", example: "14:00" })
  @IsString()
  @Matches(TIME_PATTERN, {
    message: "휴게 종료 시각의 형식이 올바르지 않습니다.",
  })
  end!: string;
}

export class BusinessDayDto implements BusinessDay {
  @ApiProperty({ description: "요일 (0=일 ~ 6=토)", minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @ApiProperty({ description: "휴무 여부" })
  @IsBoolean()
  closed!: boolean;

  @ApiProperty({ description: "개점 (HH:mm)", example: "09:00" })
  @IsString()
  @Matches(TIME_PATTERN, { message: "개점 시각의 형식이 올바르지 않습니다." })
  open!: string;

  @ApiProperty({
    description:
      "마감 (HH:mm). 개점보다 이르면 자정을 넘긴 영업으로 읽는다. 자정 마감은 24:00.",
    example: "19:00",
  })
  @IsString()
  @Matches(TIME_PATTERN, { message: "마감 시각의 형식이 올바르지 않습니다." })
  close!: string;

  // 상한을 두는 이유는 화면이 아니라 저장소다 — JSONB 한 칸에 들어가므로 갯수 제한이
  // 없으면 한 요일에 수천 개를 넣어 행을 부풀릴 수 있다. 실무상 3개면 충분하다.
  @ApiProperty({ type: [BusinessBreakDto], description: "휴게시간 (최대 3개)" })
  @IsArray()
  @ArrayMaxSize(3, { message: "휴게시간은 요일당 3개까지 등록할 수 있습니다." })
  @ValidateNested({ each: true })
  @Type(() => BusinessBreakDto)
  breaks!: BusinessBreakDto[];
}

export class BusinessHoursDto implements BusinessHours {
  @ApiProperty({ type: [BusinessDayDto], description: "요일별 운영시간 (7개)" })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessDayDto)
  days!: BusinessDayDto[];

  @ApiProperty({ description: "법정 공휴일 휴무 여부 (표기 전용)" })
  @IsBoolean()
  closedOnPublicHolidays!: boolean;

  @ApiPropertyOptional({
    description: "안내 문구",
    example: "마지막 등원 17:00까지",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note!: string | null;
}
