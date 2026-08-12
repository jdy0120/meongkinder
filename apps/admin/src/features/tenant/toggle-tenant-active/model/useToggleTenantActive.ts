"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Patch } from "@/shared/libs/axios/request";

/**
 * 테넌트 활성/정지 토글 뮤테이션 (feature model).
 * 정지시키면 해당 테넌트의 모든 요청이 서버에서 403 으로 차단된다 (TenantMiddleware).
 */
export const useToggleTenantActive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }) => {
      const res = await Patch(`/v1/tenants/${id}/active`, { isActive });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.isActive
          ? "테넌트를 다시 활성화했습니다."
          : "테넌트를 정지했습니다. 해당 매장의 모든 요청이 차단됩니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "상태 변경에 실패했습니다.";
      toast.error(msg);
    },
  });
};
