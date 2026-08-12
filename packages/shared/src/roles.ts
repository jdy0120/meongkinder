// 사용자 역할 (api·web·admin 공통)
//
// job-033 이후 역할은 두 층으로 나뉜다.
//
//  1) 플랫폼 레벨 (User.role) — 테넌트와 무관한 계정 자체의 성격
//     USER        : 일반 회원. 소속 테넌트가 없어도 자기 펫을 등록·관리할 수 있다.
//     SUPER_ADMIN : 플랫폼(pawlog 운영사) 관리자. 특정 테넌트에 속하지 않고 전체를 관리한다.
//
//  2) 테넌트 레벨 (TenantMembership.role) — "이 테넌트 안에서 무엇인가"
//     GUARDIAN     : 보호자. 이 유치원에 자기 펫을 맡긴 회원.
//     STAFF        : 돌봄 스태프(관리인). 출석/일일 리포트 등 현장 업무 전용.
//     TENANT_ADMIN : 테넌트(사업장) 관리자. 해당 매장의 전체 운영.
//
// 한 회원이 여러 테넌트에 서로 다른 자격으로 속할 수 있으므로, 요청의 "실효 역할"은
// 활성 테넌트(서브도메인/X-Tenant-Id)의 멤버십에서 정해진다. RolesGuard 가 이를 해석한다.
export const ROLES = {
  USER: "USER",
  GUARDIAN: "GUARDIAN",
  STAFF: "STAFF",
  TENANT_ADMIN: "TENANT_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** User.role 에 저장될 수 있는 값 (플랫폼 레벨). */
export const PLATFORM_ROLES = [ROLES.USER, ROLES.SUPER_ADMIN] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** TenantMembership.role 에 저장될 수 있는 값 (테넌트 레벨). */
export const MEMBERSHIP_ROLES = [
  ROLES.GUARDIAN,
  ROLES.STAFF,
  ROLES.TENANT_ADMIN,
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const isPlatformRole = (value: string): value is PlatformRole =>
  (PLATFORM_ROLES as readonly string[]).includes(value);

export const isMembershipRole = (value: string): value is MembershipRole =>
  (MEMBERSHIP_ROLES as readonly string[]).includes(value);

/**
 * 테넌트 역할의 서열 — 큰 값이 더 넓은 권한이다.
 *
 * 서열이 필요한 이유는 **초대가 기존 자격을 덮어쓰기 때문**이다. 초대는 "이 사람을
 * 넣어라"라는 뜻이지 "이 사람을 이 등급으로 낮춰라"가 아닌데, 멤버십이
 * `[userId, tenantId]` 유니크라 한 사람당 한 행뿐이라서 그냥 쓰면 구분이 안 된다.
 * 강등은 초대가 아니라 역할 변경(`PATCH v1/memberships/:id/role`)의 일이고, 그쪽에는
 * 본인 강등 차단·마지막 관리자 보호가 이미 걸려 있다.
 */
export const MEMBERSHIP_ROLE_RANK: Record<MembershipRole, number> = {
  [ROLES.GUARDIAN]: 1,
  [ROLES.STAFF]: 2,
  [ROLES.TENANT_ADMIN]: 3,
};

/** 두 역할 중 권한이 더 넓은 쪽. 같으면 첫 번째를 돌려준다. */
export const higherMembershipRole = (
  a: MembershipRole,
  b: MembershipRole,
): MembershipRole =>
  MEMBERSHIP_ROLE_RANK[b] > MEMBERSHIP_ROLE_RANK[a] ? b : a;

/**
 * 멤버십 상태.
 * 보호자가 테넌트에 가입 신청하면 PENDING 으로 만들어지고, 테넌트 관리자가 승인해야 ACTIVE 가 된다.
 * ACTIVE 가 아닌 멤버십은 해당 테넌트의 어떤 리소스에도 접근할 수 없다.
 */
export const MEMBERSHIP_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  LEFT: "LEFT",
} as const;

export type MembershipStatus =
  (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];
