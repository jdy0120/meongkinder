"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Post } from "@/shared/libs/axios/request";
import { ROLES } from "@pawlog/shared";
import type { LoginRequest, LoginResponse } from "@pawlog/shared";

/** admin 앱 접근 권한이 없는 계정(USER)으로 로그인 시도 시 구분용 에러 코드 */
export const NOT_ADMIN = "NOT_ADMIN";

/**
 * 관리자 로그인 뮤테이션 (feature model).
 *
 * job-038 이후 admin 앱은 플랫폼 운영자 전용이므로 SUPER_ADMIN 만 통과시키고,
 * 그 외 계정은 세션(쿠키)을 정리하고 거부한다. 매장 스태프·관리자는 apps/web 을 쓴다.
 *
 * 여기서 비교하는 `user.role` 은 **플랫폼 레벨**(USER | SUPER_ADMIN)이다.
 * 테넌트 역할(GUARDIAN/STAFF/TENANT_ADMIN)은 TenantMembership 에 있어 이 값에 나타나지 않는다.
 *
 * 이 검사는 UX 용이다 — 실제 차단은 `(checkauth)/layout.tsx` 의 SSR 게이트와
 * API 의 `@Roles(SUPER_ADMIN)` 가 담당한다.
 */
export const useLogin = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: async (values: LoginRequest) => {
      const res = await Post<LoginResponse, LoginRequest>(
        "/v1/auth/login",
        values,
      );

      if (res.data.data?.user.role !== ROLES.SUPER_ADMIN) {
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
