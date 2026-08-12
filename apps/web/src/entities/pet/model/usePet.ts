"use client";

import { useQuery } from "@tanstack/react-query";
import type { Pet } from "@pawlog/database";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/** 반려동물 상세 조회 (아이 정보 화면/수정 요청 폼 초기값 로딩용) */
export const usePet = (id: string) => {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ["pets", "mine", tenantId, id],
    queryFn: async () => {
      const res = await Get<{ pet: Pet }, undefined>(`/v1/pets/${id}`);
      return res.data.data?.pet;
    },
    enabled: Boolean(id),
  });
};
