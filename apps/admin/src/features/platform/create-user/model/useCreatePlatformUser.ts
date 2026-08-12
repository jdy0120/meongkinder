"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreatePlatformUserRequest,
  CreatePlatformUserResponse,
} from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 계정 발급 (feature model) — `POST v1/platform/users`.
 *
 * 성공 토스트가 초대 연결 건수까지 알려준다: 매장이 전화번호로 미리 등록해 둔
 * 원생·초대가 있으면 계정 발급과 동시에 소속 처리되기 때문에, 운영자가 "번호를 제대로
 * 넣었는지"를 이 숫자로 바로 확인할 수 있다(0이면 연결된 게 없다는 뜻).
 */
export const useCreatePlatformUser = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlatformUserRequest) => {
      const res = await Post<CreatePlatformUserResponse, CreatePlatformUserRequest>(
        "/v1/platform/users",
        input,
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      const claimed = data?.claimedInvitations ?? 0;
      toast.success(
        claimed > 0
          ? `계정을 발급했습니다. 대기 중이던 초대 ${claimed}건이 함께 연결되었습니다.`
          : "계정을 발급했습니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "계정 발급에 실패했습니다.";
      toast.error(msg);
    },
  });
};
