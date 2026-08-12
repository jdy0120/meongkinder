"use client";

import { useQuery } from "@tanstack/react-query";
import type { FileUrlResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

import { normalizeFileUrl } from "../lib/normalizeFileUrl";

/**
 * fileId 로 실제 접근 가능한 이미지 URL을 조회 (GET v1/file/:fileId).
 * 반환되는 URL은 CLOUD 저장 시 1시간 만료 SAS URL이므로, 만료 전에 새로 조회하도록
 * staleTime을 만료 시간보다 짧게 둔다. LOCAL storage(raw 스트리밍 엔드포인트) URL은
 * normalizeFileUrl 로 브라우저가 실제 접근 가능한 origin으로 보정한다.
 */
export const useFileUrl = (fileId?: string | null) => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["file-url", tenantId, fileId],
    queryFn: async () => {
      const res = await Get<FileUrlResponse, undefined>(`/v1/file/${fileId}`);
      const file = res.data.data ?? null;
      if (!file || !fileId) return file;
      return { ...file, url: normalizeFileUrl(file.url, fileId) };
    },
    enabled: Boolean(fileId),
    staleTime: 30 * 60 * 1000,
  });
};
