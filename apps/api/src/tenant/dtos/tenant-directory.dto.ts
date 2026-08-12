import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsLatitude, IsLongitude, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import type { TenantDirectoryQuery } from "@pawlog/shared";

/**
 * 매장 찾기 질의 (job-059).
 *
 * 이름 검색과 지도 영역 검색을 한 엔드포인트가 받는다. 넷(`swLat`/`swLng`/`neLat`/`neLng`)이
 * 모두 있을 때만 영역 필터가 걸리고, 하나라도 빠지면 무시한다 — 반쪽 좌표로 자르면
 * 사용자는 매장이 왜 사라졌는지 알 수 없는 결과를 보게 된다.
 */
export class TenantDirectoryQueryDto implements TenantDirectoryQuery {
  @ApiPropertyOptional({ description: "이름/서브도메인 부분 일치" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "지도 남서쪽 위도" })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  swLat?: number;

  @ApiPropertyOptional({ description: "지도 남서쪽 경도" })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  swLng?: number;

  @ApiPropertyOptional({ description: "지도 북동쪽 위도" })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  neLat?: number;

  @ApiPropertyOptional({ description: "지도 북동쪽 경도" })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  neLng?: number;
}
