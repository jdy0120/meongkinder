"use client";

import { useQuery } from "@tanstack/react-query";
import type { TenantSummary } from "@pawlog/shared";

import { GetList } from "@/shared/libs/axios/request";

/**
 * 테넌트 선택지 전체 조회 (최대 100건) — SUPER_ADMIN 테넌트 스위처에서 사용한다.
 *
 * 목록 훅과 달리 tenantId 를 캐시 키에 넣지 않는다: 이 조회는 테넌트에 스코프되지 않는
 * 플랫폼 전역 목록이라 어떤 테넌트를 보고 있든 결과가 같고, 오히려 키에 넣으면 테넌트를
 * 전환할 때마다 스위처 목록이 비어 깜빡인다.
 *
 * @param enabled SUPER_ADMIN 이 아닌 사용자는 403 이므로 호출 자체를 막는다.
 */
export const useTenantOptions = (enabled: boolean) =>
  useQuery({
    queryKey: ["tenants", "options"],
    queryFn: async () => {
      const res = await GetList<TenantSummary>("/v1/tenants", {
        page: 1,
        pageSize: 100,
        sort: "name",
        order: "asc",
      });
      return res.data.data?.items ?? [];
    },
    enabled,
  });
