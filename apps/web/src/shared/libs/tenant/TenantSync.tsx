"use client";

import { useEffect } from "react";

import {
  useTenantStore,
  type TenantMembershipSummary,
} from "@/shared/libs/zustand/stores/tenant.store";

interface TenantSyncProps {
  memberships: TenantMembershipSummary[];
}

/**
 * (checkauth) 레이아웃의 SSR mypage 결과(소속 목록)를 client 전역 store 로 흘려보낸다.
 *
 * job-033: JWT 에 tenantId 가 없어졌으므로 활성 매장은 클라이언트가 정해 `X-Tenant-Id` 헤더로
 * 알려줘야 한다. store 가 저장된 선택을 유지하되, 그 소속이 사라졌으면 첫 ACTIVE 소속으로
 * 자동 복구한다(탈퇴·반려 후에도 화면이 깨지지 않도록).
 */
export const TenantSync = ({ memberships }: TenantSyncProps) => {
  const setMemberships = useTenantStore((state) => state.setMemberships);

  useEffect(() => {
    setMemberships(memberships);
  }, [memberships, setMemberships]);

  return null;
};
