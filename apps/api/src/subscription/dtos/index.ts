import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

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
