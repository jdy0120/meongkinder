"use client";

import { useEffect } from "react";
import type { MembershipRole } from "@pawlog/shared";

import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

interface TenantRouteSyncProps {
  tenantId: string;
  /** 이 매장에서의 내 소속 역할. 소속 없이 들어온 SUPER_ADMIN 열람이면 null. */
  role: MembershipRole | null;
  /** job-050: 소속이 아니라 플랫폼 권한으로 들어왔는가. */
  isPlatformAdmin?: boolean;
  tenantName?: string | null;
}

/**
 * URL 의 `[tenant]` 로 확정된 매장을 client store 에 심는다 (job-038).
 *
 * `(tenantAuth)/tenant/[tenant]/layout.tsx` 가 SSR 에서 소속·상태를 모두 검증한 뒤에만 렌더되므로,
 * 여기 들어오는 값은 이미 "이 사용자가 쓸 수 있는 매장"임이 보장된다.
 *
 * 언마운트 시 개인 스코프로 되돌린다 — 매장 영역을 벗어났는데 헤더가 남아 있으면
 * "내 아이" 같은 개인 화면이 그 매장으로 스코프돼 목록이 비어 보인다.
 */
export const TenantRouteSync = ({
  tenantId,
  role,
  isPlatformAdmin = false,
  tenantName = null,
}: TenantRouteSyncProps) => {
  const enterTenant = useTenantStore((state) => state.enterTenant);
  const leaveTenant = useTenantStore((state) => state.leaveTenant);

  useEffect(() => {
    enterTenant({ tenantId, role, isPlatformAdmin, tenantName });
    return () => leaveTenant();
  }, [
    tenantId,
    role,
    isPlatformAdmin,
    tenantName,
    enterTenant,
    leaveTenant,
  ]);

  return null;
};
