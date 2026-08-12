import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import type { UpdateTenantSettingsRequest } from "@pawlog/shared";

import { TenantAddressDto } from "./tenant-address.dto";

/**
 * 매장 설정 수정 (job-059) — TENANT_ADMIN 이 **자기 매장**을 고친다.
 *
 * ⚠️ `subdomain` 은 일부러 없다. 바꾸면 그 매장의 모든 링크(보호자에게 이미 공유된
 * 주소 포함)가 죽는다. 원장이 설정 화면에서 무심코 할 일이 아니라, 플랫폼 경로
 * (`PATCH v1/tenants/:id`, SUPER_ADMIN)에 그대로 남겨 둔다.
 *
 * ⚠️ `isActive` 도 없다. 매장 정지는 구독/미납과 묶인 플랫폼 판단이라 원장이 자기
 * 매장을 되살리는 스위치가 되면 안 된다.
 */
export class UpdateTenantSettingsDto
  extends TenantAddressDto
  implements UpdateTenantSettingsRequest
{
  @ApiPropertyOptional({ description: "매장 이름" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: "매장 대표 연락처. 하이픈 허용(저장은 숫자만)",
    example: "02-1234-5678",
  })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({
    description: "공개 매장 찾기(지도·목록) 노출 여부",
  })
  @IsOptional()
  @IsBoolean()
  isListed?: boolean;
}
