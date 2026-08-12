"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SubscriptionPlan } from "@pawlog/database";
import type { SellTicketRequest } from "@pawlog/shared";

import { Get, Post } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/**
 * 판매 가능한 요금제 목록 (job-051).
 *
 * 서버가 테넌트 컨텍스트로 좁혀 내려주므로 **이 유치원 상품만** 온다. 판매 중지된
 * 요금제는 애초에 목록에 없다(`isActive` 필터) — 팔 수 없는 걸 고르게 하면 400 을 본다.
 */
export const useSellablePlans = (enabled = true) => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["sellable-plans", tenantId],
    queryFn: async () => {
      const res = await Get<SubscriptionPlan[], undefined>(
        "/v1/subscriptions/plans",
      );
      return res.data.data ?? [];
    },
    enabled: enabled && Boolean(tenantId),
  });
};

/**
 * 현장 판매 (feature model) — 대면 결제를 받고 이용권을 개통한다.
 *
 * 성공 시 원생 목록·잔액·매출을 모두 무효화한다. 한 번의 판매가 세 화면을 동시에
 * 바꾸기 때문이다 — 잔액이 늘고, 이용권이 생기고, 그 달 매출이 올라간다.
 */
export const useSellTicket = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SellTicketRequest) => {
      const res = await Post("/v1/subscriptions/ledgers/sell", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("이용권을 판매했습니다.");
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-monthly"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-summary"] });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "판매에 실패했습니다.");
    },
  });
};
