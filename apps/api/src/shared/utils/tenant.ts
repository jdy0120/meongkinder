// job-020 (Phase 1: DB 스키마 & RLS) 임시 스텁.
// 서브도메인/헤더/JWT 로 실제 tenantId 를 해석하는 TenantMiddleware + AsyncLocalStorage 컨텍스트는
// docs/multi-tenant-migration-plan.md Phase 3 에서 도입됩니다. 그 전까지는 서비스 전체가 단일
// default-tenant 로 동작하므로, 스키마 전환으로 tenantId 가 필수가 된 호출부는 이 상수를 사용합니다.
// (packages/database seed.ts / 마이그레이션 20260730070000_backfill_default_tenant 와 동일한 고정 UUID)
export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * 서브도메인으로 쓸 수 없는 예약어.
 *
 * 막는 것:
 *  1. 플랫폼 공용 호스트/로컬 개발 호스트 (www, api, admin, mail, ftp, lvh …)
 *  2. apps/web 의 고정 경로 (아래 두 번째 그룹)
 *
 * **두 번째 그룹은 더 이상 필수가 아니다.** 매장 경로에 `tenant/` 접두사가 생기면서
 * (`/tenant/<subdomain>/…`) 매장 주소와 web 최상위 경로가 서로 다른 네임스페이스를 쓴다.
 * 접두사가 없던 시절엔 subdomain 이 `pet` 인 매장이 정적 세그먼트 `/pet`(내 아이)에 가려
 * 영원히 열리지 않았고, 그래서 web 에 최상위 경로를 추가할 때마다 이 목록을 함께
 * 갱신해야 했다 — 이제 그 의무는 없다.
 *
 * 그럼에도 남겨 두는 이유는 방어 목적이다: 이미 이 이름으로 가입한 매장이 없고, 나중에
 * 호스트 기반 라우팅(acme.pawlog.com)으로 옮길 때 헷갈릴 여지를 줄인다. 특정 이름을
 * 매장에 풀어 주고 싶다면 이 그룹에서 지워도 라우팅은 깨지지 않는다.
 *
 * TenantMiddleware(Host 서브도메인 해석)와 온보딩(신규 subdomain 검증)이 같은 목록을 본다.
 */
export const RESERVED_SUBDOMAINS = new Set([
  // 플랫폼/인프라 — 반드시 유지
  "www",
  "api",
  "admin",
  "mail",
  "ftp",
  "lvh", // lvh.me 자체 호스트(서브도메인 없음)
  // apps/web 최상위 경로 — 경로 충돌은 해소됐고, 이제는 관례상 예약
  "app",
  "auth",
  "pet",
  "pets",
  "reports",
  "subscriptions",
  "tenant",
  "tenants",
  "onboarding",
  "profile",
  "members",
  "users",
  "attendance",
  "daily-reports",
]);

// 서브도메인 형식: 소문자 영숫자 + 하이픈, 2~63자, 하이픈으로 시작/종료 불가.
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** 대소문자/공백을 정규화한다. 실제 형식/예약어 검증은 별도로 assertValidSubdomain 을 사용한다. */
export function normalizeSubdomain(value: string): string {
  return value.trim().toLowerCase();
}

/** 서브도메인 형식이 유효하고 예약어가 아니면 null, 아니면 사용자에게 보여줄 사유 문자열을 반환한다. */
export function validateSubdomainFormat(subdomain: string): string | null {
  if (subdomain.length < 2 || subdomain.length > 63) {
    return "서브도메인은 2~63자여야 합니다.";
  }
  if (!SUBDOMAIN_RE.test(subdomain)) {
    return "서브도메인은 소문자 영문/숫자와 하이픈(-)만 사용할 수 있고, 하이픈으로 시작하거나 끝날 수 없습니다.";
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return "예약된 서브도메인이라 사용할 수 없습니다.";
  }
  return null;
}
