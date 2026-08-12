"use client";

import { useQuery } from "@tanstack/react-query";
import type { MySubscriptionResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/** 나의 현재 구독(정기권) 상태 조회 */
export const useMySubscription = () => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["subscriptions", "mine", tenantId],
    queryFn: async () => {
      const res = await Get<MySubscriptionResponse, undefined>(
        "/v1/subscriptions/mine",
      );
      return res.data.data;
    },
  });
};
