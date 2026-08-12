"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreatePetRequest } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 보호자 본인의 아이 등록 뮤테이션 (feature model).
 *
 * 매장이 대신 등록하는 `POST /v1/admin/pets` 와 다른 엔드포인트를 쓴다. 이쪽은 **보호자
 * 소유**로만 만들고 매장(tenantId)은 비워 둔다 — 어느 매장에도 다니지 않는 개인 보호자도
 * 자기 아이를 등록할 수 있어야 하고, 유치원 등록은 그 다음 조작(등원)이기 때문이다.
 */
export const useCreateMyPet = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePetRequest) => {
      const res = await Post("/v1/pets", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("아이가 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "등록에 실패했습니다.");
    },
  });
};
