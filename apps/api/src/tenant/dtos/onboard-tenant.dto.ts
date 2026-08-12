import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import type { OnboardTenantRequest } from "@pawlog/shared";

import { TenantAddressDto } from "./tenant-address.dto";

/**
 * job-034: 매장 개설권을 보유한 로그인 회원이 호출한다.
 * 요청자가 그대로 TENANT_ADMIN 이 되므로 관리자 계정 정보를 따로 받지 않는다.
 *
 * job-059: 주소를 함께 받되 **선택**이다. 개설을 주소에 묶으면 주소가 아직 확정되지
 * 않은 매장이 시작조차 못 한다 — 나중에 매장 설정에서 넣어도 되고, 그 동안 잃는 것은
 * 지도 노출 하나뿐이다.
 */
export class OnboardTenantDto
  extends TenantAddressDto
  implements OnboardTenantRequest
{
  @ApiProperty({ description: "테넌트(매장) 이름", example: "멍멍이 유치원" })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiProperty({
    description: "서브도메인 (소문자 영숫자 + 하이픈, 2~63자)",
    example: "mungmung",
  })
  @IsString()
  @IsNotEmpty()
  subdomain: string;
}
