"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Patch } from "@/shared/libs/axios/request";

/**
 * 사용자 역할 변경 뮤테이션 (feature model).
 * 성공 시 users 목록 캐시를 무효화한다. 에러 타입은 전역 증강으로 자동 추론된다.
 */
export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await Patch(`/v1/admin/users/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      toast.success("사용자 역할이 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "역할 변경에 실패했습니다.";
      toast.error(msg);
    },
  });
};
