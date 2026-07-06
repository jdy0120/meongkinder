import type { PaginatedData } from "@template/shared";

// 응답 data 가 없을 때(에러/빈 응답)의 안전한 기본값
export const emptyPage = <T>(): PaginatedData<T> => ({
  items: [],
  meta: {
    page: 1,
    pageSize: 0,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
});
