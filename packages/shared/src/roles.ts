// 사용자 역할 (api·web·admin 공통)
// USER  : 서비스(web)만 이용
// ADMIN : 서비스(web) + 관리자(admin) 모두 이용
export const ROLES = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
