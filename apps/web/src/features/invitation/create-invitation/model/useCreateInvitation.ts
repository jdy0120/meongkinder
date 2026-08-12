"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateInvitationRequest,
  CreateInvitationResponse,
} from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 구성원 초대 (feature model).
 *
 * 서버가 두 갈래로 처리한다 — 상대가 이미 회원이면 곧바로 소속 처리되고,
 * 아니면 연락처·아이 정보만 저장돼 나중에 가입할 때 자동 매칭된다.
 * 응답에 membership 이 있는지로 두 경우를 구분해 안내 문구를 다르게 준다.
 */
export const useCreateInvitation = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvitationRequest) => {
      const res = await Post<CreateInvitationResponse, CreateInvitationRequest>(
        "/v1/invitations",
        data,
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(
        data?.membership
          ? "이미 가입된 회원이라 곧바로 구성원으로 추가했습니다."
          : "초대를 등록했습니다. 해당 연락처로 가입하면 자동으로 소속됩니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "초대에 실패했습니다.";
      toast.error(msg);
    },
  });
};
