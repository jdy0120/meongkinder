"use client";

import { useQuery } from "@tanstack/react-query";
import type { SharedDailyReportResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";

/**
 * 공개 알림장 조회 (로그인 불필요, job-040).
 *
 * 알림톡을 받은 **미가입 보호자**가 여는 경로다. 401 을 정상 응답으로 처리해 공유 axios
 * 인터셉터의 "토큰 갱신 → 로그인 페이지로 하드 리다이렉트"에 걸리지 않게 한다 — 그렇지
 * 않으면 로그인하지 않은 방문자가 알림장 대신 로그인 화면으로 튕긴다.
 * (랜딩 페이지의 useMe 가 같은 이유로 같은 처리를 한다)
 */
export const useSharedDailyReport = (token: string) =>
  useQuery({
    queryKey: ["daily-reports", "shared", token],
    queryFn: async () => {
      const res = await Get<SharedDailyReportResponse, { token: string }>(
        "/v1/daily-reports/shared",
        { token },
        {
          validateStatus: (status) =>
            status === 200 || status === 400 || status === 401 || status === 404,
        },
      );
      return res.data.data ?? null;
    },
    enabled: Boolean(token),
    // 만료된 링크를 계속 두드리게 두지 않는다.
    retry: false,
  });
