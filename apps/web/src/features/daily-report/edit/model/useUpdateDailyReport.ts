"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdateDailyReportRequest } from "@pawlog/shared";

import { Patch } from "@/shared/libs/axios/request";
import type { DailyReportWithContents } from "@/entities/daily-report";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

interface UpdateDailyReportInput {
  id: string;
  data: UpdateDailyReportRequest;
}

/**
 * 일일 리포트 수정 뮤테이션 (feature model).
 * contents 를 전달하면 서버가 기존 항목을 대체하고 AI 코멘트 초안을 재생성해 함께 내려준다.
 */
export const useUpdateDailyReport = () => {
  const queryClient = useQueryClient();
  const tenantId = useTenantStore((state) => state.tenantId);

  return useMutation({
    mutationFn: async ({ id, data }: UpdateDailyReportInput) => {
      const res = await Patch<
        { dailyReport: DailyReportWithContents },
        UpdateDailyReportRequest
      >(`/v1/daily-reports/${id}`, data);
      if (!res.data.data) {
        throw new Error("일일 리포트 응답을 확인할 수 없습니다.");
      }
      return res.data.data.dailyReport;
    },
    onSuccess: (dailyReport) => {
      queryClient.invalidateQueries({ queryKey: ["daily-reports"] });
      queryClient.invalidateQueries({
        queryKey: ["daily-report", tenantId, dailyReport.id],
      });
    },
    onError: (error) => {
      const msg =
        error.response?.data?.message || "일일 리포트 수정에 실패했습니다.";
      toast.error(msg);
    },
  });
};
