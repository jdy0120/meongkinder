"use client";

import { useQuery } from "@tanstack/react-query";
import type { TermsDetail } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";

/**
 * 활성 약관 목록 (본문 포함).
 *
 * `GET /v1/terms` 는 `@Public()` 이라 로그인 전에도 열린다. 동의를 받으려면 무엇에
 * 동의하는지 읽을 수 있어야 하므로, 최초 진입 게이트가 이 본문을 다이얼로그로 보여준다.
 */
export const useActiveTerms = () =>
  useQuery({
    queryKey: ["terms", "active"],
    queryFn: async () => {
      const res = await Get<TermsDetail[], undefined>("/v1/terms");
      return res.data.data ?? [];
    },
    // 약관 본문은 자주 바뀌지 않는다.
    staleTime: 5 * 60 * 1000,
  });
