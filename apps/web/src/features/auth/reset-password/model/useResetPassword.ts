"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Post } from "@/shared/libs/axios/request";
import type { ResetPasswordRequest, MessageResponse } from "@template/shared";

/**
 * 비밀번호 재설정 뮤테이션 (feature model).
 * 성공 시 로그인 페이지로 이동한다.
 */
export const useResetPassword = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: (values: ResetPasswordRequest) =>
      Post<MessageResponse, ResetPasswordRequest>(
        "/v1/auth/reset-password",
        values,
      ),
    onSuccess: () => {
      router.replace("/auth/login");
    },
  });
};
