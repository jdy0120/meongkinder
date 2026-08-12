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

type TenantStore = {
  /** 내가 ACTIVE/PENDING 으로 속한 매장 목록 (SSR mypage 결과). 매장 전환기의 선택지. */
  memberships: TenantMembershipSummary[];
  /**
   * 현재 보고 있는 매장. **URL 의 `[tenant]` 세그먼트가 결정한다** (job-038).
   * axios 인터셉터가 X-Tenant-Id 로 실어 보내고 쿼리 키에도 들어간다.
   * 매장 영역 밖(내 아이, 내 매장 등 개인 스코프)에서는 null 이다.
   */
  tenantId: string | null;
  /**
   * 현재 매장에서의 내 역할. 네비게이션 메뉴 노출 기준.
   * **소속이 없는 SUPER_ADMIN 열람 중에는 null 이다** — 이 값은 어디까지나 "내 소속 역할"이라
   * 없는 소속을 있는 것처럼 꾸미지 않는다. 메뉴 노출은 `isPlatformAdmin` 이 따로 판단한다.
   */
  currentRole: MembershipRole | null;
  /**
   * 지금 매장을 **플랫폼 운영자 자격으로** 보고 있는가 (job-050).
   *
   * SUPER_ADMIN 은 어떤 테넌트에도 속하지 않지만 모든 매장을 열 수 있다
   * (TenantMiddleware 가 멤버십 검사를 건너뛰고, 매장 컨트롤러들이 @Roles 에
   * SUPER_ADMIN 을 명시 나열한다). 소속이 아니라 **권한**으로 들어온 것이므로
   * 화면에도 그렇게 드러나야 한다 — 배너 노출과 메뉴 개방이 이 값으로 갈린다.
   */
  isPlatformAdmin: boolean;
  /** 현재 매장 이름. 소속이 없으면 mypage 로 알 수 없어 게이트가 직접 조회해 넣는다. */
  currentTenantName: string | null;
  setMemberships: (memberships: TenantMembershipSummary[]) => void;
  /** `(tenantAuth)/tenant/[tenant]/layout` 이 호출한다. 직접 부르지 말 것. */
  enterTenant: (params: {
    tenantId: string;
    role: MembershipRole | null;
    isPlatformAdmin?: boolean;
    tenantName?: string | null;
  }) => void;
  /** 매장 영역을 벗어날 때 개인 스코프로 되돌린다. */
  leaveTenant: () => void;
};

/**
 * job-033/038: 한 회원이 여러 매장에 다른 자격으로 속할 수 있고 JWT 는 tenantId 를 담지 않는다.
 * 그래서 "지금 어느 매장인가"는 클라이언트가 정해 헤더로 알려줘야 하는데, 그 근거를
 * localStorage 가 아니라 **URL** 로 삼는다 — 주소가 곧 상태라 공유·북마크가 되고,
 * 두 매장을 두 탭에서 동시에 열어도 서로 섞이지 않는다.
 */
export const useTenantStore = create<TenantStore>((set) => ({
  memberships: [],
  tenantId: null,
  currentRole: null,
  isPlatformAdmin: false,
  currentTenantName: null,

  setMemberships: (memberships) => set({ memberships }),

  enterTenant: ({ tenantId, role, isPlatformAdmin = false, tenantName = null }) =>
    set({
      tenantId,
      currentRole: role,
      isPlatformAdmin,
      currentTenantName: tenantName,
    }),

  leaveTenant: () =>
    set({
      tenantId: null,
      currentRole: null,
      isPlatformAdmin: false,
      currentTenantName: null,
    }),
}));
