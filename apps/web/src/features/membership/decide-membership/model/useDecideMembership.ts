"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MEMBERSHIP_STATUS, type MembershipStatus } from "@pawlog/shared";

import { Patch } from "@/shared/libs/axios/request";

type Decision = Extract<MembershipStatus, "ACTIVE" | "REJECTED">;

/**
 * 가입 신청 승인/반려 (feature model).
 * 승인하면 그 순간부터 해당 보호자가 매장 리소스에 접근할 수 있게 된다.
 */
export const useDecideMembership = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Decision }) => {
      const res = await Patch(`/v1/memberships/${id}/decide`, { status });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === MEMBERSHIP_STATUS.ACTIVE
          ? "가입을 승인했습니다."
          : "가입 신청을 반려했습니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "처리에 실패했습니다.";
      toast.error(msg);
    },
  });
};
