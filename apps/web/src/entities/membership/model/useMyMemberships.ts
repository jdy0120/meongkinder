"use client";

import { useQuery } from "@tanstack/react-query";
import type { MembershipWithTenant } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";

/**
 * 내가 속한/신청한 매장 목록 (entity model).
 *
 * 테넌트를 가로지르는 조회라 캐시 키에 tenantId 를 넣지 않는다 — 어느 매장을 보고 있든
 * 결과가 같고, 키에 넣으면 매장 전환 시 목록이 불필요하게 다시 로딩된다.
 */
export const useMyMemberships = () =>
  useQuery({
    queryKey: ["memberships", "mine"],
    queryFn: async () => {
      const res = await Get<
        { memberships: MembershipWithTenant[] },
        undefined
      >("/v1/memberships/mine");
      return res.data.data?.memberships ?? [];
    },
  });
