"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdatePetRequest } from "@pawlog/shared";

import { Patch } from "@/shared/libs/axios/request";

/**
 * 아이 정보 수정 요청 뮤테이션 (feature model). 본인 소유 반려동물만 수정 가능한
 * 기존 v1/pets 엔드포인트를 재사용한다. 성공 시 pets 캐시를 무효화한다.
 */
export const useRequestEditPet = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdatePetRequest & { id: string }) => {
      const res = await Patch(`/v1/pets/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("아이 정보가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "수정 요청에 실패했습니다.";
      toast.error(msg);
    },
  });
};
