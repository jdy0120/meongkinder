"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateDailyReportRequest } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";
import type { DailyReportWithContents } from "@/entities/daily-report";

/**
 * 일일 리포트 작성 뮤테이션 (feature model).
 * 응답의 dailyReport.aiCommentDraft 는 서버가 항목 내용을 바탕으로 규칙 기반으로
 * 즉시 생성해 함께 내려준다 (별도의 AI 초안 생성 API는 없음).
 */
export const useCreateDailyReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDailyReportRequest) => {
      const res = await Post<{ dailyReport: DailyReportWithContents }, CreateDailyReportRequest>(
        "/v1/daily-reports",
        data,
      );
      if (!res.data.data) {
        throw new Error("일일 리포트 응답을 확인할 수 없습니다.");
      }
      return res.data.data.dailyReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-reports"] });
    },
    onError: (error) => {
      const msg =
        error.response?.data?.message || "일일 리포트 작성에 실패했습니다.";
      toast.error(msg);
    },
  });
};
