import type { BaseResponse } from "./response";

export type SortOrder = "asc" | "desc";

/** 클라이언트가 목록 API 에 보내는 쿼리 (모두 선택) */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sort?: string; // 정렬 기준 필드명 (예: "createdAt")
  order?: SortOrder; // 정렬 방향
  search?: string; // 검색어
}

/** 기본값이 채워지고 범위가 보정된 쿼리 */
export interface NormalizedPagination {
  page: number;
  pageSize: number;
  sort?: string;
  order: SortOrder;
  search?: string;
}

/** 응답에 함께 내려주는 페이지 메타 정보 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** 목록 응답 본문 */
export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

/** 서버가 최종적으로 내려주는 목록 응답 (BaseResponse 로 감쌈) */
export type PaginatedResponse<T> = BaseResponse<PaginatedData<T>>;
