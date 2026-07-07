"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Post } from "@/shared/libs/axios/request";
import type { LoginRequest, LoginResponse } from "@template/shared";

/**
 * 로그인 뮤테이션 (feature model).
 * 인증은 httpOnly 쿠키로 처리되어 응답 본문에 토큰이 없다. 성공 시 홈으로 이동.
 * 에러 타입은 global.d.ts 로 AxiosError<BaseResponse> 로 전역 증강되어 자동 추론된다.
 */
export const useLogin = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: (values: LoginRequest) =>
      Post<LoginResponse, LoginRequest>("/v1/auth/login", values),
    onSuccess: () => {
      router.replace("/");
    },
  });
};
