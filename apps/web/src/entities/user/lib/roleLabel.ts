import { ROLES, type Role } from "@pawlog/shared";

/** 역할 코드 ↔ 표시 라벨 (구성원 목록, 초대 등에서 공용) */
export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "플랫폼 관리자",
  [ROLES.TENANT_ADMIN]: "관리자",
  [ROLES.STAFF]: "돌봄 스태프",
  [ROLES.GUARDIAN]: "보호자",
  [ROLES.USER]: "일반 사용자",
};

export const roleLabel = (role: string): string =>
  ROLE_LABELS[role as Role] || role;

export const roleBadgeStyle = (role: string): string => {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return "border-amber-300 bg-amber-50 text-amber-700";
    case ROLES.TENANT_ADMIN:
      return "border-blue-300 bg-blue-50 text-blue-700";
    case ROLES.STAFF:
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    default:
      return "border-muted bg-muted text-muted-foreground";
  }
};
