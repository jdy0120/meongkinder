"use client";

import { useMutation } from "@tanstack/react-query";

import { Post } from "@/shared/libs/axios/request";
import type { ForgotPasswordRequest, MessageResponse } from "@template/shared";

/**
 * 비밀번호 찾기 뮤테이션 (feature model).
 * 계정 열거 방지를 위해 서버는 가입 여부와 무관하게 동일 메시지를 반환한다.
 */
export const useForgotPassword = () =>
  useMutation({
    mutationFn: (values: ForgotPasswordRequest) =>
      Post<MessageResponse, ForgotPasswordRequest>(
        "/v1/auth/forgot-password",
        values,
      ),
  });
