"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Patch } from "@/shared/libs/axios/request";

/** 약관 버전 활성/비활성 토글 뮤테이션 (feature model) */
export const useToggleTermsActive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await Patch(`/v1/admin/terms/${id}/active`, {
        isActive: active,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("약관 활성화 상태가 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["terms"] });
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "활성화 설정에 실패했습니다.";
      toast.error(msg);
    },
  });
};
