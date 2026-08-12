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

export const roleBadgeStyle = (role: string): string => {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case ROLES.TENANT_ADMIN:
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case ROLES.STAFF:
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
};
