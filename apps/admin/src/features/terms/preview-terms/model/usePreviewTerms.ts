"use client";

import { useQuery } from "@tanstack/react-query";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";
import type { TermsDetail } from "@/entities/terms";

/** 약관 본문 상세 조회 (feature model). previewId 가 있을 때만 요청한다. */
export const usePreviewTerms = (previewId: string | null) => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["terms", "detail", tenantId, previewId],
    queryFn: async () => {
      if (!previewId) return null;
      const res = await Get<TermsDetail, unknown>(
        `/v1/admin/terms/${previewId}`,
      );
      return res.data.data;
    },
    enabled: !!previewId,
  });
};
