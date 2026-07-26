import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";
import type { ConfirmPaymentRequest } from "@pawlog/shared";

// 토스 결제창 성공 리다이렉트의 쿼리 파라미터를 그대로 전달받습니다.
export class ConfirmPaymentDto implements ConfirmPaymentRequest {
  @ApiProperty({ description: "토스 결제 키", example: "tviva20240101..." })
  @IsString()
  @IsNotEmpty()
  paymentKey: string;

  @ApiProperty({ description: "주문 ID", example: "order_a1b2c3d4" })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: "결제 금액(원)", example: 10000 })
  @IsInt()
  @Min(100)
  amount: number;
}
