"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  SeatPlanListResponse,
  SubscribeSeatResponse,
} from "@pawlog/shared";

import { Get, Post } from "@/shared/libs/axios/request";

/**
 * 매장 개설권 요금제 목록 (공개). 테넌트 컨텍스트가 필요 없다.
 *
 * `paymentRequired` 가 함께 온다 — 서버가 결제 없이 발급하는 상태인지(job-056). 이 값을
 * 프런트 환경변수로 따로 두지 않는 이유는 두 곳이 어긋나면 화면이 거짓말을 하기 때문이다.
 */
export const useSeatPlans = () =>
  useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const res = await Get<SeatPlanListResponse, undefined>(
        "/v1/platform-subscriptions/plans",
      );
      return (
        res.data.data ?? { plans: [], paymentRequired: true }
      );
    },
  });

/** 내 개설권 목록 — tenantId 가 null 인 건이 아직 쓰지 않은 개설권이다. */
export interface SeatSubscription {
  id: string;
  status: string;
  tenantId: string | null;
  plan: { name: string; price: number };
  tenant: { id: string; name: string; subdomain: string } | null;
}

export const useMySeats = () =>
  useQuery({
    queryKey: ["platform-subscriptions", "mine"],
    queryFn: async () => {
      const res = await Get<
        { subscriptions: SeatSubscription[] },
        undefined
      >("/v1/platform-subscriptions/mine");
      return res.data.data?.subscriptions ?? [];
    },
  });

/**
 * 개설권 발급 (feature model).
 *
 * 기본은 결제 경로다 — 토스 빌링키가 먼저 등록돼 있어야 하고, `TOSS_SECRET_KEY` 가 없는
 * 환경에서는 서버가 503 을 반환한다(그 메시지를 그대로 노출해 원인이 드러나게 한다).
 * 서버에 `ALLOW_UNPAID_TENANT_SEAT` 가 켜져 있으면 결제 없이 발급되고, 응답의 `paid` 로
 * 그 사실이 내려온다 — 토스트가 둘을 구분해서 말한다(job-056).
 */
export const useSubscribeSeat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const res = await Post<SubscribeSeatResponse, { planId: string }>(
        "/v1/platform-subscriptions/subscribe",
        { planId },
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(
        data?.paid === false
          ? "개설권이 발급되었습니다. (결제 연동 전이라 결제는 이뤄지지 않았습니다)"
          : "구독이 완료되었습니다. 이제 매장을 개설할 수 있습니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["platform-subscriptions"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "결제에 실패했습니다.";
      toast.error(msg);
    },
  });
};
