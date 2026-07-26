import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import type { CancelPaymentRequest } from "@pawlog/shared";

export class CancelPaymentDto implements CancelPaymentRequest {
  @ApiProperty({ description: "취소 사유", example: "고객 변심" })
  @IsString()
  @IsNotEmpty()
  cancelReason: string;

  @ApiProperty({
    description: "부분 취소 금액(원). 미지정 시 전액 취소",
    example: 5000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  cancelAmount?: number;
}
