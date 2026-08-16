import { ROLES, type Role } from "@pawlog/shared";

/** 역할 코드 ↔ 표시 라벨 (사이드바 프로필, 역할 셀렉트 등에 공용) */
export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "플랫폼 관리자",
  [ROLES.TENANT_ADMIN]: "테넌트 관리자",
  [ROLES.STAFF]: "돌봄 스태프",
  [ROLES.GUARDIAN]: "보호자",
  [ROLES.USER]: "일반 사용자",
};

export const roleLabel = (role: string): string => ROLE_LABELS[role as Role] || role;

/**
 * 역할 뱃지 스타일.
 *
 * `SUPER_ADMIN` 만 강조색을 받는다 — 이 목록에서 색으로 구분할 가치가 있는 것은
 * "플랫폼 전체 권한을 가진 계정인가" 하나뿐이고, 나머지 역할은 테넌트 안에서만
 * 의미가 있어 이 콘솔에서는 라벨로 충분하다. 역할마다 색을 배정하면 색이 분류를
 * 뜻하게 되어 정작 위험한 계정이 눈에 띄지 않는다.
 */
export const roleBadgeStyle = (role: string): string => {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return "bg-primary-tint text-primary-on-tint";
    default:
      return "bg-secondary text-text-muted";
  }
};
