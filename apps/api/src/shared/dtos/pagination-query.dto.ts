import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { PAGINATION_DEFAULTS } from "@pawlog/shared";
import type { PaginationQuery, SortOrder } from "@pawlog/shared";

/**
 * 공통 목록 쿼리 DTO — 모든 목록 API 에서 재사용.
 * 실제 보정/skip·take 계산은 @pawlog/shared 의 resolvePagination 이 담당한다.
 */
export class PaginationQueryDto implements PaginationQuery {
  @ApiPropertyOptional({
    description: "페이지 (1부터)",
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: "페이지 크기",
    default: PAGINATION_DEFAULTS.pageSize,
    minimum: 1,
    maximum: PAGINATION_DEFAULTS.maxPageSize,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_DEFAULTS.maxPageSize)
  pageSize?: number;

  @ApiPropertyOptional({
    description: "정렬 기준 필드명",
    example: "createdAt",
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: "정렬 방향", enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: SortOrder;

  @ApiPropertyOptional({ description: "검색어" })
  @IsOptional()
  @IsString()
  search?: string;
}
