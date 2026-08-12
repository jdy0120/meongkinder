import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CheckSubdomainAvailabilityDto {
  @ApiProperty({ description: "확인할 서브도메인", example: "mungmung" })
  @IsString()
  @IsNotEmpty()
  subdomain: string;
}
