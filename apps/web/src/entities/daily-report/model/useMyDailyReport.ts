"use client";

import { useQuery } from "@tanstack/react-query";
import type { DailyReportWithPetAndContents } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/** 보호자 - 리포트 상세 조회 (본인 소유 확인은 서버에서 처리) */
export const useMyDailyReport = (id: string) => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["daily-reports", "mine", tenantId, id],
    queryFn: async () => {
      const res = await Get<{ dailyReport: DailyReportWithPetAndContents }, undefined>(
        `/v1/daily-reports/mine/${id}`,
      );
      return res.data.data?.dailyReport;
    },
    enabled: Boolean(id),
  });
};
