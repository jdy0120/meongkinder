"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Post } from "@/shared/libs/axios/request";
import type { LoginRequest, LoginResponse } from "@pawlog/shared";

/**
 * 로그인 뮤테이션 (feature model).
 * 인증은 httpOnly 쿠키로 처리되어 응답 본문에 토큰이 없다. 성공 시 /app 으로 이동.
 * 에러 타입은 global.d.ts 로 AxiosError<BaseResponse> 로 전역 증강되어 자동 추론된다.
 */
export const useLogin = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: (values: LoginRequest) =>
      Post<LoginResponse, LoginRequest>("/v1/auth/login", values),
    onSuccess: () => {
      // job-042: 착지점은 소속에 따라 갈린다(매장 하나면 그 매장으로 직행).
      // 그 판단은 /launch 가 하므로 여기서 /app 을 직접 고르지 않는다.
      router.replace("/launch");
    },
  });
};
