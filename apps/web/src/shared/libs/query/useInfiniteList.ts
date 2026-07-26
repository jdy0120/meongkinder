"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { PaginatedData, PaginationQuery } from "@pawlog/shared";

import { GetList } from "@/shared/libs/axios/request";

import { emptyPage } from "./emptyPage";

/**
 * 무한 스크롤 / "더보기"형 목록 훅.
 * 서버 meta 의 hasNext 로 다음 페이지 존재 여부를 자동 판단한다.
 *
 * @example
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
 *   useInfiniteList<Order>("orders", "/payments/orders", { pageSize: 20 });
 * const orders = data?.pages.flatMap((p) => p.items) ?? [];
 * // <button onClick={() => fetchNextPage()} disabled={!hasNextPage}>더보기</button>
 */
export function useInfiniteList<T>(
  key: string,
  url: string,
  query: Omit<PaginationQuery, "page"> = {},
) {
  return useInfiniteQuery({
    queryKey: [key, "infinite", query],
    queryFn: async ({ pageParam }) => {
      const res = await GetList<T>(url, { ...query, page: pageParam });
      return res.data.data ?? emptyPage<T>();
    },
    initialPageParam: 1,
    getNextPageParam: (last: PaginatedData<T>) =>
      last.meta.hasNext ? last.meta.page + 1 : undefined,
  });
}
