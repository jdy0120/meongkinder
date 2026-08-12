"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Delete } from "@/shared/libs/axios/request";

/** 대기 중인 초대 취소 (feature model). */
export const useCancelInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await Delete(`/v1/invitations/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("초대를 취소했습니다.");
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "취소에 실패했습니다.";
      toast.error(msg);
    },
  });
};
