import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import type { TenantAddressInput } from "@pawlog/shared";

/**
 * 매장 주소 입력 (job-059).
 *
 * 매장 개설과 매장 설정이 같은 모양으로 주소를 받으므로 한 곳에 두고 상속한다 —
 * 두 벌로 두면 한쪽에만 필드를 추가하는 일이 반드시 생긴다.
 *
 * ⚠️ 좌표(`latitude`/`longitude`)는 **여기서 받지 않는다.** 클라이언트가 보내게 하면
 * 주소와 좌표가 서로 다른 곳을 가리켜도 서버가 알 수 없다. 서버가 주소를 지오코딩해서
 * 직접 채운다(`GeocodingService`).
 */
export class TenantAddressDto implements TenantAddressInput {
  @ApiPropertyOptional({ description: "우편번호", example: "06236" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({
    description: "도로명 주소 (지도 핀에 노출되는 공개 정보)",
    example: "서울 강남구 테헤란로 152",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  roadAddress?: string;

  @ApiPropertyOptional({
    description: "상세주소(층/호). 공개 디렉터리에는 실리지 않는다.",
    example: "3층 301호",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressDetail?: string;
}
