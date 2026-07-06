import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class CreateOrderDto {
  @ApiProperty({ description: "주문명", example: "포인트 10,000원 충전" })
  @IsString()
  @IsNotEmpty()
  orderName: string;

  @ApiProperty({ description: "결제 금액(원)", example: 10000 })
  @IsInt()
  @Min(100) // 토스 최소 결제 금액
  amount: number;
}
