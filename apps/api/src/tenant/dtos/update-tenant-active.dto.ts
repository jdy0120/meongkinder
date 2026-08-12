import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";
import type { UpdateTenantActiveRequest } from "@pawlog/shared";

export class UpdateTenantActiveDto implements UpdateTenantActiveRequest {
  @ApiProperty({
    description:
      "활성 여부. false 로 두면 TenantMiddleware 가 해당 테넌트의 모든 요청을 403 으로 차단한다.",
    example: false,
  })
  @IsBoolean()
  isActive: boolean;
}
