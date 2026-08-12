"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Patch } from "@/shared/libs/axios/request";

interface UpdateProfilePayload {
  nickname?: string;
  phone?: string;
}

interface UpdateProfileResult {
  claimedInvitations: number;
}

/**
 * 내 정보 수정 (feature model).
 *
 * 전화번호를 등록하면 서버가 그 번호로 와 있던 매장 초대를 자동으로 소속 처리한다
 * (카카오 로그인은 전화번호를 주지 않아 가입 시점에는 매칭할 수 없다).
 * 몇 건이 연결됐는지 응답으로 오므로 사용자에게 알려준다.
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfilePayload) => {
      const res = await Patch<UpdateProfileResult, UpdateProfilePayload>(
        "/v1/auth/me",
        data,
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      const claimed = data?.claimedInvitations ?? 0;
      toast.success(
        claimed > 0
          ? `정보를 저장했습니다. 대기 중이던 매장 초대 ${claimed}건이 연결되었습니다.`
          : "정보를 저장했습니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "저장에 실패했습니다.";
      toast.error(msg);
    },
  });
};
