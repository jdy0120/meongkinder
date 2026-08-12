"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RefundSaleRequest, RefundSaleResponse } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 판매 환불 (feature model) — job-054.
 *
 * 성공하면 매출·잔액·이용권이 한꺼번에 바뀌므로 관련 쿼리를 모두 무효화한다.
 *
 * **PG 취소는 여기서 하지 않는다.** 카드 결제였다면 응답의 `paymentKey` 로 그 사실을
 * 토스트에 알린다 — 실제 돈을 돌려주는 건 비가역 작업이라, 토스 취소가 실패했는데
 * 장부만 환불된 상태를 만들지 않으려고 일부러 두 단계로 나눴다.
 */
export const useRefundSale = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      saleId,
      ...payload
    }: RefundSaleRequest & { saleId: string }) => {
      const res = await Post<RefundSaleResponse, RefundSaleRequest>(
        `/v1/subscriptions/ledgers/sales/${saleId}/refund`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      const revoked = data?.revokedCount
        ? ` 잔여 ${data.revokedCount}회를 회수했습니다.`
        : "";
      toast.success(
        `${(data?.refundAmount ?? 0).toLocaleString()}원 환불 처리했습니다.${revoked}`,
      );

      // 카드 결제건은 장부만 정리된 상태다. 이 안내가 없으면 원장은 돈이 돌아간 줄 안다.
      if (data?.paymentKey) {
        toast.warning(
          "카드 결제 건입니다. 실제 환불은 결제 취소를 별도로 진행해야 합니다.",
          { duration: 8000 },
        );
      }

      queryClient.invalidateQueries({ queryKey: ["revenue-monthly"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-summary"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "환불에 실패했습니다.");
    },
  });
};
