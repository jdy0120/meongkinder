import { create } from "zustand";
import type { MembershipRole } from "@pawlog/shared";

/** mypage 가 내려주는 소속 정보 중 화면에서 쓰는 최소 형태. */
export interface TenantMembershipSummary {
  tenantId: string;
  role: MembershipRole;
  status: string;
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    isActive: boolean;
  };
}

const SELECTED_STORAGE_KEY = "pawlog.admin.selectedTenant";

const readStoredSelection = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStoredSelection = (tenantId: string | null): void => {
  if (typeof window === "undefined") return;
  try {
    if (tenantId) window.localStorage.setItem(SELECTED_STORAGE_KEY, tenantId);
    else window.localStorage.removeItem(SELECTED_STORAGE_KEY);
  } catch {
    // 프라이빗 모드 등 접근 실패는 무시 — 메모리 상태만으로도 동작한다.
  }
};

type TenantStore = {
  /** 내가 ACTIVE/PENDING 으로 속한 매장 목록 (SSR mypage 결과). */
  memberships: TenantMembershipSummary[];
  /**
   * 현재 운영 중인 매장. axios 인터셉터가 X-Tenant-Id 로 실어 보내고 쿼리 키에도 들어간다.
   * null 이면 테넌트 컨텍스트 없음 — 관리자 라우트는 403 이 된다(개인 스코프).
   */
  tenantId: string | null;
  /** 현재 매장에서의 내 역할. 사이드바 메뉴 노출 기준. */
  currentRole: MembershipRole | null;
  setMemberships: (memberships: TenantMembershipSummary[]) => void;
  selectTenant: (tenantId: string | null) => void;
};

const resolveRole = (
  memberships: TenantMembershipSummary[],
  tenantId: string | null,
): MembershipRole | null =>
  memberships.find((m) => m.tenantId === tenantId && m.status === "ACTIVE")
    ?.role ?? null;

/**
 * job-033: 한 회원이 여러 매장에 서로 다른 자격으로 속할 수 있고, JWT 는 더 이상 tenantId 를
 * 담지 않는다. 따라서 "지금 어느 매장을 운영 중인가"는 전적으로 클라이언트가 정해 헤더로 알려준다.
 *
 * SUPER_ADMIN 은 멤버십이 없으므로 memberships 가 비어 있고, 테넌트 스위처가 전체 매장 목록에서
 * 직접 선택한다(selectTenant).
 */
export const useTenantStore = create<TenantStore>((set, get) => ({
  memberships: [],
  tenantId: readStoredSelection(),
  currentRole: null,

  setMemberships: (memberships) => {
    const active = memberships.filter((m) => m.status === "ACTIVE");
    const current = get().tenantId;

    // 저장된 선택이 아직 유효하면 유지한다. 아니면 첫 ACTIVE 소속으로 떨어뜨리되,
    // 소속이 하나도 없으면(SUPER_ADMIN 등) 저장된 선택을 그대로 존중한다.
    const stillValid = active.some((m) => m.tenantId === current);
    const next = stillValid ? current : (active[0]?.tenantId ?? current);

    if (next !== current) writeStoredSelection(next);
    set({ memberships, tenantId: next, currentRole: resolveRole(memberships, next) });
  },

  selectTenant: (tenantId) => {
    writeStoredSelection(tenantId);
    set({ tenantId, currentRole: resolveRole(get().memberships, tenantId) });
  },
}));
