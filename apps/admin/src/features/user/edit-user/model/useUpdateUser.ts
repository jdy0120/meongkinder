"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Patch } from "@/shared/libs/axios/request";
import type { UpdateUserRequest } from "@template/shared";

/**
 * 사용자 정보 수정 뮤테이션 (feature model). 성공 시 users 목록 캐시를 무효화한다.
 */
export const useUpdateUser = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateUserRequest & { id: string }) => {
      const res = await Patch(`/v1/admin/users/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("사용자 정보가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "수정에 실패했습니다.";
      toast.error(msg);
    },
  });
};
