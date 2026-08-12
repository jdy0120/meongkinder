"use client";

import { useQuery } from "@tanstack/react-query";
import type { PetWithOwner } from "@pawlog/shared";

import { GetList } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/** 아이 태그 선택지 등 목록 전반에서 재사용하는 반려동물 전체 조회 (최대 100건) */
export const usePetOptions = () => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["pets", "options", tenantId],
    queryFn: async () => {
      const res = await GetList<PetWithOwner>("/v1/admin/pets", {
        page: 1,
        pageSize: 100,
      });
      return res.data.data?.items ?? [];
    },
  });
};
