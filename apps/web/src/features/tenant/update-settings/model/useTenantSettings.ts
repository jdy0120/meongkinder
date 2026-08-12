"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  TenantSettings,
  UpdateTenantSettingsRequest,
  UpdateTenantSettingsResponse,
} from "@pawlog/shared";

import { Get, Patch } from "@/shared/libs/axios/request";

const QUERY_KEY = ["tenant-settings"];

/** 매장 설정 조회 (원장 전용). 상세주소까지 전부 내려온다. */
export const useTenantSettings = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await Get<{ tenant: TenantSettings }, undefined>(
        "/v1/tenants/settings",
      );
      return res.data.data?.tenant ?? null;
    },
  });

/**
 * 매장 설정 저장.
 *
 * ⚠️ 성공 토스트가 두 갈래다. 좌표를 못 얻으면(`geocodeFailed`) 저장 자체는 성공했지만
 * **그 매장은 지도에 뜨지 않는다.** 그걸 말해주지 않으면 원장은 주소를 넣었는데 왜
 * 매장 찾기에 안 나오는지 영영 알 수 없다.
 */
export const useUpdateTenantSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTenantSettingsRequest) => {
      const res = await Patch<
        UpdateTenantSettingsResponse,
        UpdateTenantSettingsRequest
      >("/v1/tenants/settings", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      if (data?.geocodeFailed) {
        toast.warning(
          "저장했지만 주소의 좌표를 찾지 못해 지도에는 표시되지 않습니다. 주소를 다시 검색해 선택해보세요.",
        );
        return;
      }
      toast.success("매장 정보가 저장되었습니다.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? "저장에 실패했습니다.");
    },
  });
};
