"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginationQuery } from "@template/shared";

import { GetList } from "@/shared/libs/axios/request";

import { emptyPage } from "./emptyPage";

/**
 * 페이지 버튼형 목록 훅 (1, 2, 3 …).
 *
 * @param key   쿼리 캐시 키 접두사 (예: "orders")
 * @param url   목록 API 경로 (예: "/payments/orders")
 * @param query page/pageSize/sort/order/search
 *
 * @example
 * const { data, isLoading } = usePaginatedList<Order>(
 *   "orders", "/payments/orders", { page, pageSize: 20 },
 * );
 * data?.items;          // Order[]
 * data?.meta.totalPages;
 */
export function usePaginatedList<T>(
  key: string,
  url: string,
  query: PaginationQuery = {},
) {
  return useQuery({
    // query 가 바뀌면 자동으로 재요청 + 별도 캐시
    queryKey: [key, "list", query],
    queryFn: async () => {
      const res = await GetList<T>(url, query);
      return res.data.data ?? emptyPage<T>();
    },
    // 페이지 전환 시 이전 데이터를 유지해 깜빡임 방지
    placeholderData: keepPreviousData,
  });
}
