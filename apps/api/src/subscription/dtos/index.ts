import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  CreateSubscriptionLedgerRequest,
  UpdateSubscriptionLedgerRequest,
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
}

export class CreateSubscriptionLedgerDto
  implements CreateSubscriptionLedgerRequest
{
  @ApiProperty({ description: "대상 사용자 ID" })
  @IsString()
  @IsNotEmpty()
  userId!: string;

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

  @ApiProperty({ description: "변동 후 잔여 횟수" })
  @IsInt()
  balanceAfter!: number;

  @ApiPropertyOptional({ description: "상세 내용" })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSubscriptionLedgerDto
  implements UpdateSubscriptionLedgerRequest
{
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

  @ApiPropertyOptional({ description: "변동 후 잔여 횟수" })
  @IsOptional()
  @IsInt()
  balanceAfter?: number;

  @ApiPropertyOptional({ description: "상세 내용" })
  @IsOptional()
  @IsString()
  description?: string;
}
