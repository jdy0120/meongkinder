import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  SALE_METHODS,
  SUBSCRIPTION_PLAN_SCOPES,
  SUBSCRIPTION_PLAN_TYPES,
  type SaleMethod,
  type CreateSubscriptionLedgerRequest,
  type CreateSubscriptionPlanRequest,
  type SubscriptionPlanScope,
  type SubscriptionPlanType,
  type UpdateSubscriptionLedgerRequest,
  type UpdateSubscriptionPlanRequest,
} from "@pawlog/shared";

export class IssueBillingKeyDto {
  @ApiProperty({ description: "토스페이먼츠 인증 키" })
  @IsString()
  @IsNotEmpty()
  authKey!: string;

  @ApiProperty({ description: "토스페이먼츠 고객 식별 키" })
  @IsString()
  @IsNotEmpty()
  customerKey!: string;
}

export class CreateSubscriptionDto {
  @ApiProperty({ description: "구독할 요금제 ID" })
  @IsString()
  @IsNotEmpty()
  planId!: string;

  /**
   * 어느 아이의 이용권인지 (job-045).
   * 잔액이 아이 단위로 쌓이므로 COUNT/PERIOD(횟수제) 요금제는 필수다 —
   * 없으면 충전분이 갈 곳이 없다. 검증은 조합 조건이라 서비스에서 한다.
   */
  @ApiPropertyOptional({
    description: "이용권을 충전할 원생 ID (횟수제 요금제 필수)",
  })
  @IsOptional()
  @IsString()
  petId?: string;
}

export class CreateSubscriptionPlanDto implements CreateSubscriptionPlanRequest {
  @ApiProperty({
    description: "요금제 이름 (예: 10회권, 월 무제한, 호텔 1박권)",
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "결제 금액 (원)" })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({
    description:
      "결제 주기 (MONTHLY | YEARLY) — planType=RECURRING 유형에서만 사용",
  })
  @IsString()
  @IsNotEmpty()
  interval!: string;

  @ApiPropertyOptional({ description: "설명" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "상품 유형",
    enum: SUBSCRIPTION_PLAN_TYPES,
  })
  @IsIn(SUBSCRIPTION_PLAN_TYPES)
  planType!: SubscriptionPlanType;

  @ApiPropertyOptional({
    description:
      "총 제공 횟수 (COUNT/PERIOD 유형 필수, 예: 10회권=10, 호텔1박권=1)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalCount?: number;

  @ApiPropertyOptional({
    description: "구매일로부터 유효기간(일) — RECURRING 이 아닌 유형은 필수",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @ApiPropertyOptional({ description: "판매 활성화 여부", default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      "판매 대상 — TENANT(원생 이용권, 기본) | PLATFORM(매장 개설권)",
    enum: SUBSCRIPTION_PLAN_SCOPES,
    default: "TENANT",
  })
  @IsOptional()
  @IsIn(SUBSCRIPTION_PLAN_SCOPES)
  scope?: SubscriptionPlanScope;
}

export class UpdateSubscriptionPlanDto implements UpdateSubscriptionPlanRequest {
  @ApiPropertyOptional({ description: "요금제 이름" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "결제 금액 (원)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: "결제 주기 (MONTHLY | YEARLY)" })
  @IsOptional()
  @IsString()
  interval?: string;

  @ApiPropertyOptional({ description: "설명" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "상품 유형",
    enum: SUBSCRIPTION_PLAN_TYPES,
  })
  @IsOptional()
  @IsIn(SUBSCRIPTION_PLAN_TYPES)
  planType?: SubscriptionPlanType;

  @ApiPropertyOptional({ description: "총 제공 횟수 (COUNT/PERIOD 유형)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalCount?: number;

  @ApiPropertyOptional({ description: "구매일로부터 유효기간(일)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @ApiPropertyOptional({ description: "판매 활성화 여부" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSubscriptionLedgerDto implements CreateSubscriptionLedgerRequest {
  @ApiProperty({ description: "대상 원생 ID (이용권의 주인)" })
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @ApiPropertyOptional({
    description: "대상 보호자 계정 ID (감사 정보, 없을 수 있음)",
  })
  @IsOptional()
  @IsString()
  userId?: string | undefined;

  @ApiPropertyOptional({ description: "연동된 구독 ID" })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({ description: "연동된 출석 기록 ID" })
  @IsOptional()
  @IsString()
  attendanceId?: string;

  @ApiProperty({ description: "종류 (CHARGE | USE | REFUND | EXPIRE)" })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ description: "변동 횟수 (차감: 음수, 충전: 양수)" })
  @IsInt()
  amount!: number;

  // job-045: balanceAfter 는 서버가 계산한다. 호출부가 넣으면 동시 요청에서 서로 덮어써
  // 회수권이 공짜가 되거나 두 번 차감된다.

  @ApiPropertyOptional({ description: "상세 내용" })
  @IsOptional()
  @IsString()
  description?: string;
}

/** 이용권 충전 (job-045) — 원장이 현장에서 결제받고 횟수를 넣어준다. */
export class ChargeLedgerDto {
  @ApiProperty({ description: "보정할 원생 ID" })
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @ApiProperty({ description: "보정 횟수 (양수)", example: 10 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ description: "사유 (예: 서비스 보상 1회)" })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * 현장 판매 (job-051) — 원장이 대면 결제를 받고 이용권을 개통한다.
 * 횟수·유효기간·정가는 요금제에서 따라오므로 여기서 받지 않는다.
 */
export class SellTicketDto {
  @ApiProperty({ description: "이용권을 사는 원생 ID" })
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @ApiProperty({ description: "판매할 요금제 ID (이 매장의 판매 중인 요금제)" })
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @ApiProperty({
    description: "결제 수단",
    enum: SALE_METHODS,
    example: "CASH",
  })
  @IsIn(SALE_METHODS as unknown as string[])
  method!: SaleMethod;

  @ApiPropertyOptional({
    description:
      "실제 수령 금액(원). 생략하면 요금제 정가. 할인 판매를 그대로 장부에 남기기 위한 값이다.",
    example: 180000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: "메모 (예: 형제 할인)" })
  @IsOptional()
  @IsString()
  memo?: string;
}

export class UpdateSubscriptionLedgerDto implements UpdateSubscriptionLedgerRequest {
  @ApiPropertyOptional({ description: "연동된 구독 ID" })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({ description: "연동된 출석 기록 ID" })
  @IsOptional()
  @IsString()
  attendanceId?: string;

  @ApiPropertyOptional({ description: "종류 (CHARGE | USE | REFUND | EXPIRE)" })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: "변동 횟수 (차감: 음수, 충전: 양수)" })
  @IsOptional()
  @IsInt()
  amount?: number;

  @ApiPropertyOptional({ description: "상세 내용" })
  @IsOptional()
  @IsString()
  description?: string;
}

/** 최근 N개월 매출 추이 조회 (job-051). */
export class MonthlyRevenueQueryDto {
  @ApiPropertyOptional({
    description: "조회할 개월 수 (1~24, 기본 6)",
    example: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number = 6;
}

/** 특정 월 매출 상세 조회 (job-051). */
export class RevenueSummaryQueryDto {
  @ApiProperty({ description: "연도", example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2999)
  year!: number;

  @ApiProperty({ description: "월 (1~12)", example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

/** 판매 환불 (job-054). 금액을 비우면 남은 전액을 환불한다. */
export class RefundSaleDto {
  @ApiPropertyOptional({
    description:
      "환불 금액(원). 생략하면 남은 전액. 부분 환불(이미 제공한 몫은 매출로 남김)에 쓴다.",
    example: 140000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ description: "환불 사유", example: "이사로 퇴원" })
  @IsOptional()
  @IsString()
  reason?: string;
}
