"use client";

import { useQuery } from "@tanstack/react-query";
import type { SafeUser } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";

/**
 * 로그인 여부 확인 (entity model).
 *
 * 랜딩 페이지처럼 로그인 없이도 접근 가능한 화면에서 쓰기 때문에, 401을 axios
 * 인터셉터의 refresh-then-redirect 흐름(interceptors.ts)에 태우지 않도록
 * validateStatus로 401도 정상 응답 취급한다 — 그렇지 않으면 로그아웃 상태로
 * 랜딩 페이지를 열었을 때 강제로 /auth/login 으로 리다이렉트된다.
 */
export const useMe = () =>
  useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await Get<{ user: SafeUser }, undefined>(
        "/v1/auth/mypage",
        undefined,
        { validateStatus: (status) => status === 200 || status === 401 },
      );
      return res.status === 200 ? (res.data.data?.user ?? null) : null;
    },
  });
