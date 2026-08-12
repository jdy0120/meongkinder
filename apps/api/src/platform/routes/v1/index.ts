/**
 * 플랫폼 운영 (job-037) — pawlog 운영사(SUPER_ADMIN) 전용.
 *
 * `v1/admin/*` 과의 차이가 핵심이다:
 *   - `v1/admin/*`    : **한 매장** 안의 관리 (TENANT_ADMIN). 활성 테넌트로 스코프된다.
 *   - `v1/platform/*` : **전 플랫폼** 관리 (SUPER_ADMIN). 테넌트 스코프를 의도적으로 벗어난다.
 *
 * 그래서 이 모듈의 모든 조회/변경은 `runWithoutTenant` 안에서 실행된다.
 */
export const PLATFORM_ROUTES = {
  BASE: "v1/platform",

  // 전 플랫폼 회원
  LIST_USERS: "users", // GET:    전체 회원 목록 (소속 매장 요약 포함, 검색·페이지네이션)
  CREATE_USER: "users", // POST:   계정 발급 (운영진 계정 · 소셜 로그인이 어려운 회원 대행 가입)
  GET_USER: "users/:id", // GET:    회원 상세 (소속 이력 전체)
  UPDATE_USER_STATUS: "users/:id/status", // PATCH:  계정 정지/해제
  UPDATE_USER_ROLE: "users/:id/role", // PATCH:  SUPER_ADMIN 승격/강등
  DELETE_USER: "users/:id", // DELETE: 계정 삭제

  // 전 플랫폼 구독 (매장 개설권 = SaaS 매출)
  LIST_SEAT_SUBSCRIPTIONS: "subscriptions", // GET: 전체 개설권 구독 현황
} as const;
