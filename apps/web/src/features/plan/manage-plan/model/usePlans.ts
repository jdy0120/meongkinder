"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateSubscriptionPlanRequest,
  UpdateSubscriptionPlanRequest,
} from "@pawlog/shared";

import { Delete, Patch, Post } from "@/shared/libs/axios/request";

/**
 * 요금제 관리 (feature model) — job-051.
 *
 * 요금제는 **이 유치원의 상품**이다. 서버가 테넌트 컨텍스트에서 소유자를 정하므로
 * 요청 본문에 tenantId 를 담지 않는다 — 담으면 남의 유치원에 상품을 심을 수 있다.
 */
const PLANS_QUERY_KEY = ["tenant-plans"];

export const useCreatePlan = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSubscriptionPlanRequest) => {
      const res = await Post("/v1/subscriptions/plans", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("요금제가 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "등록에 실패했습니다.");
    },
  });
};

export const useUpdatePlan = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: UpdateSubscriptionPlanRequest & { id: string }) => {
      const res = await Patch(`/v1/subscriptions/plans/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("요금제가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "수정에 실패했습니다.");
    },
  });
};

/**
 * 판매 중지 (soft delete). 물리 삭제하지 않는 이유는 이미 팔린 이용권과 매출 기록이
 * 이 요금제를 가리키고 있어서다 — 지우면 과거 매출의 상품명이 사라진다.
 */
export const useDeletePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await Delete(`/v1/subscriptions/plans/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("판매를 중지했습니다.");
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "처리에 실패했습니다.");
    },
  });
};
