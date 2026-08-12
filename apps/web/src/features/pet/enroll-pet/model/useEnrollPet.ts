"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Post } from "@/shared/libs/axios/request";

/**
 * 등원 — 내 아이를 소속된 매장의 원생으로 등록한다 (feature model).
 * 서버는 그 매장의 ACTIVE 구성원인지만 확인한다(승인 대기 중이면 거부).
 */
export const useEnrollPet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      petId,
      tenantId,
    }: {
      petId: string;
      tenantId: string;
    }) => {
      const res = await Post(`/v1/pets/${petId}/enroll`, { tenantId });
      return res.data;
    },
    onSuccess: () => {
      toast.success("아이를 매장에 등록했습니다.");
      queryClient.invalidateQueries({ queryKey: ["pets"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "등록에 실패했습니다.";
      toast.error(msg);
    },
  });
};

/** 등원 해지 — 개인 아이로 되돌린다. 지난 출석·리포트 기록은 매장에 남는다. */
export const useUnenrollPet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (petId: string) => {
      const res = await Post(`/v1/pets/${petId}/unenroll`, {});
      return res.data;
    },
    onSuccess: () => {
      toast.success("등원을 해지했습니다.");
      queryClient.invalidateQueries({ queryKey: ["pets"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "해지에 실패했습니다.";
      toast.error(msg);
    },
  });
};
