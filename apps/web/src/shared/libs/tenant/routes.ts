/**
 * 매장 화면 주소를 만드는 단 하나의 지점.
 *
 * 매장 경로는 `/tenant/<subdomain>/…` 이다. 접두사 없이 `/<subdomain>/…` 이던 시절엔
 * 매장 주소가 web 최상위 경로와 같은 네임스페이스를 써서, subdomain 이 `pet` 인 매장이
 * 정적 세그먼트 `/pet`(내 아이)에 가려 열리지 않았다. 접두사가 그 충돌을 없앤다.
 *
 * 화면에서 `` `/${tenant}/…` `` 처럼 직접 조립하지 말고 이 함수를 쓸 것 — 접두사가 또
 * 바뀌더라도 고칠 곳이 여기 하나로 끝난다.
 */
export const TENANT_PATH_PREFIX = "/tenant";

/**
 * @example tenantPath("acme")                       // "/tenant/acme"
 * @example tenantPath("acme", "daily-reports")      // "/tenant/acme/daily-reports"
 * @example tenantPath("acme", "daily-reports", id, "edit")
 */
export const tenantPath = (subdomain: string, ...segments: string[]) =>
  [TENANT_PATH_PREFIX, subdomain, ...segments].join("/");

/**
 * 지금 보고 있는 경로에서 매장만 바꾼 주소.
 * 단순 문자열 replace 는 접두사(`/tenant`)에 먼저 걸릴 수 있어(예: subdomain 이 `ten`)
 * 세그먼트 단위로 교체한다.
 */
export const replaceTenantInPath = (pathname: string, subdomain: string) => {
  const segments = pathname.split("/").filter(Boolean);
  // ["tenant", "<subdomain>", ...rest]
  if (segments[0] !== TENANT_PATH_PREFIX.slice(1) || segments.length < 2) {
    return tenantPath(subdomain);
  }
  return tenantPath(subdomain, ...segments.slice(2));
};
