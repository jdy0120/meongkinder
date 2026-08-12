"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  TenantDirectoryEntry,
  TenantDirectoryQuery,
} from "@pawlog/shared";

import { Get, Post } from "@/shared/libs/axios/request";

/**
 * 가입 신청할 매장 찾기 (공개 디렉터리).
 *
 * job-059: 이름 검색과 **지도 영역 검색**을 함께 받는다. 예전에는 검색어가 있을 때만
 * 호출해서, 보호자는 매장 이름을 이미 알고 있어야만 찾을 수 있었다 — 실제로 하는
 * 질문은 "우리 동네에 어디 있지?"인데 그걸 물어볼 방법이 없었다.
 *
 * 서버는 상세주소(층/호)를 내려주지 않는다. 공개 응답이기 때문이다.
 */
export const useTenantDirectory = (
  search: string,
  bounds?: TenantDirectoryQuery,
) => {
  const params: TenantDirectoryQuery = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(bounds ?? {}),
  };
  // 검색어도 영역도 없으면 부를 이유가 없다(전국 목록을 받아봐야 쓸 데가 없다).
  const enabled = Boolean(params.search || params.swLat !== undefined);

  return useQuery({
    queryKey: ["tenant-directory", params],
    queryFn: async () => {
      const res = await Get<
        { tenants: TenantDirectoryEntry[] },
        TenantDirectoryQuery
      >("/v1/tenants/directory", params);
      return res.data.data?.tenants ?? [];
    },
    enabled,
  });
};

/**
 * 보호자로 매장 가입 신청 (feature model).
 * 신청은 곧바로 이용 가능해지는 게 아니라 관리자 승인 대기(PENDING) 상태로 들어간다.
 */
export const useApplyMembership = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await Post("/v1/memberships/apply", { tenantId });
      return res.data;
    },
    onSuccess: () => {
      toast.success("가입 신청이 접수되었습니다. 승인을 기다려주세요.");
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "신청에 실패했습니다.";
      toast.error(msg);
    },
  });
};
