"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Post } from "@/shared/libs/axios/request";
import { ROLES } from "@template/shared";
import type { LoginRequest, LoginResponse } from "@template/shared";

/** ADMIN 이 아닌 계정으로 로그인 시도 시 구분용 에러 코드 */
export const NOT_ADMIN = "NOT_ADMIN";

/**
 * 관리자 로그인 뮤테이션 (feature model).
 * 인증 성공 후 ADMIN 역할만 허용하며, 그 외 계정은 세션(쿠키)을 정리하고 거부한다.
 */
export const useLogin = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: async (values: LoginRequest) => {
      const res = await Post<LoginResponse, LoginRequest>(
        "/v1/auth/login",
        values,
      );

      if (res.data.data?.user.role !== ROLES.ADMIN) {
        await Post("/v1/auth/logout", {});
        throw new Error(NOT_ADMIN);
      }

      return res.data;
    },
    onSuccess: () => {
      router.replace("/");
    },
  });
};
