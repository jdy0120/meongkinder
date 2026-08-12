import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import type { UpdateTenantRequest } from "@pawlog/shared";

export class UpdateTenantDto implements UpdateTenantRequest {
  @ApiPropertyOptional({
    description: "테넌트(매장) 이름",
    example: "멍멍이 유치원",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description:
      "서브도메인 (소문자 영숫자 + 하이픈, 2~63자). 변경 시 기존 접속 URL 이 무효화된다.",
    example: "mungmung",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subdomain?: string;
}
