export const ADMIN_ROUTES = {
  BASE: "v1/admin",
  ME: "me", // GET:   관리자 본인 정보
  LIST_USERS: "users", // GET:   사용자 목록
  UPDATE_USER: "users/:id", // PATCH: 사용자 정보 수정 (닉네임·상태)
  UPDATE_USER_ROLE: "users/:id/role", // PATCH: 역할 변경 (승격/강등)
  LIST_SUBSCRIPTIONS: "subscriptions", // GET: 구독 목록
  LIST_TERMS: "terms", // GET: 모든 약관 버전 목록
  GET_TERMS: "terms/:id", // GET: 약관 상세
  CREATE_TERMS: "terms", // POST: 약관 등록
  UPDATE_TERMS_ACTIVE: "terms/:id/active", // PATCH: 약관 활성화 토글
} as const;
