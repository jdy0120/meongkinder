"use client";

import { useQuery } from "@tanstack/react-query";
import type { Pet } from "@pawlog/database";

import { GetList } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/** 내 반려동물 전체 목록 — 리포트 필터/아이 정보 화면 등에서 공용으로 재사용 (최대 50건) */
export const usePets = () => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["pets", "mine", tenantId],
    queryFn: async () => {
      const res = await GetList<Pet>("/v1/pets", {
        page: 1,
        pageSize: 50,
        sort: "createdAt",
        order: "asc",
      });
      return res.data.data?.items ?? [];
    },
  });
};
