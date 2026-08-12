"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MembershipRole } from "@pawlog/shared";

import { Delete, Patch } from "@/shared/libs/axios/request";

/** 구성원 역할 변경 (feature model). 매장 단위 자격이라 멤버십 id 로 지정한다. */
export const useUpdateMemberRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: MembershipRole }) => {
      const res = await Patch(`/v1/memberships/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      toast.success("역할이 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "역할 변경에 실패했습니다.";
      toast.error(msg);
    },
  });
};

/**
 * 구성원 내보내기 (feature model).
 * 서버가 마지막 관리자는 거부하므로(매장 잠김 방지) 그 메시지를 그대로 노출한다.
 */
export const useRemoveMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await Delete(`/v1/memberships/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("구성원을 내보냈습니다.");
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "처리에 실패했습니다.";
      toast.error(msg);
    },
  });
};
