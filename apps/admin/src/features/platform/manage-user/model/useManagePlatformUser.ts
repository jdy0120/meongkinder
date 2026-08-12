"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PlatformRole } from "@pawlog/shared";

import { Delete, Patch } from "@/shared/libs/axios/request";

/** 계정 정지/해제 (feature model). 소속(멤버십)은 건드리지 않으므로 해제 시 그대로 복구된다. */
export const useUpdateUserStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await Patch(`/v1/platform/users/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === "SUSPENDED"
          ? "계정을 정지했습니다."
          : "계정 정지를 해제했습니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "처리에 실패했습니다.";
      toast.error(msg);
    },
  });
};

/**
 * 플랫폼 역할 변경 (feature model) — USER ↔ SUPER_ADMIN.
 * 테넌트 역할(GUARDIAN/STAFF/TENANT_ADMIN)은 매장의 구성원 관리에서 다룬다.
 */
export const useUpdatePlatformRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: PlatformRole }) => {
      const res = await Patch(`/v1/platform/users/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      toast.success("플랫폼 역할이 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "역할 변경에 실패했습니다.";
      toast.error(msg);
    },
  });
};

/**
 * 계정 삭제 (feature model).
 * 서버가 본인 삭제와 "매장의 마지막 관리자" 삭제를 거부하므로 그 메시지를 그대로 노출한다.
 */
export const useDeletePlatformUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await Delete(`/v1/platform/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("계정이 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "삭제에 실패했습니다.";
      toast.error(msg);
    },
  });
};
