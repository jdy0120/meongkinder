"use client";

import { useQuery } from "@tanstack/react-query";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

import type { DailyReportWithContents } from "./types";

/** 일일 리포트 상세 조회 (수정 화면 초기값 로딩용) */
export const useDailyReport = (id: string) => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["daily-report", tenantId, id],
    queryFn: async () => {
      const res = await Get<{ dailyReport: DailyReportWithContents }, undefined>(
        `/v1/daily-reports/${id}`,
      );
      return res.data.data?.dailyReport;
    },
    enabled: Boolean(id),
  });
};
