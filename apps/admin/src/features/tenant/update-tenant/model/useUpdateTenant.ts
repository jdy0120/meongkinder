"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdateTenantRequest } from "@pawlog/shared";

import { Patch } from "@/shared/libs/axios/request";

/**
 * 테넌트 정보 수정 뮤테이션 (feature model).
 * 성공 시 목록과 스위처 선택지 캐시를 함께 무효화한다 — 이름/서브도메인이 두 곳에 모두 노출된다.
 */
export const useUpdateTenant = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: UpdateTenantRequest & { id: string }) => {
      const res = await Patch(`/v1/tenants/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("테넌트 정보가 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "수정에 실패했습니다.";
      toast.error(msg);
    },
  });
};
