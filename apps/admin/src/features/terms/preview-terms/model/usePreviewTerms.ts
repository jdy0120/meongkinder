"use client";

import { useQuery } from "@tanstack/react-query";

import { Get } from "@/shared/libs/axios/request";
import type { TermsDetail } from "@/entities/terms";

/** 약관 본문 상세 조회 (feature model). previewId 가 있을 때만 요청한다. */
export const usePreviewTerms = (previewId: string | null) =>
  useQuery({
    queryKey: ["terms", "detail", previewId],
    queryFn: async () => {
      if (!previewId) return null;
      const res = await Get<TermsDetail, unknown>(
        `/v1/admin/terms/${previewId}`,
      );
      return res.data.data;
    },
    enabled: !!previewId,
  });
