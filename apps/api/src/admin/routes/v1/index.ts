export const ADMIN_ROUTES = {
  BASE: "admin",
  ME: "me", // GET:   관리자 본인 정보
  LIST_USERS: "users", // GET:   사용자 목록
  UPDATE_USER_ROLE: "users/:id/role", // PATCH: 역할 변경 (승격/강등)
} as const;
