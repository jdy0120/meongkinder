"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdatePetRequest } from "@pawlog/shared";

import { Patch } from "@/shared/libs/axios/request";

/**
 * 반려동물 정보 수정 뮤테이션 (feature model). 성공 시 pets 목록 캐시를 무효화한다.
 */
export const useUpdatePet = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdatePetRequest & { id: string }) => {
      const res = await Patch(`/v1/admin/pets/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("반려동물 정보가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "수정에 실패했습니다.";
      toast.error(msg);
    },
  });
};
