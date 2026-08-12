import { cookies } from "next/headers";
import type { TenantLookup } from "@pawlog/shared";

/**
 * 서브도메인으로 매장 1건을 조회한다 (job-050) — 매장 게이트 전용, 서버에서만 호출한다.
 *
 * SUPER_ADMIN 은 어떤 테넌트에도 속하지 않으므로 `mypage` 의 소속 목록에서 tenantId 를
 * 얻을 수 없다. URL 에 있는 건 subdomain 뿐이라, 게이트가 매장을 특정하려면 이 조회가 필요하다.
 * 소속이 있는 사용자는 이 경로를 타지 않는다 — 멤버십에 이미 tenantId 가 들어 있다.
 *
 * 엔드포인트 자체가 `@Roles(SUPER_ADMIN)` 이므로, 권한이 없으면 여기서 403 을 받아 null 이 된다.
 * 즉 **권한 판정을 웹이 하지 않는다** — 게이트는 UX 이고 실제 방어는 API 다.
 */
export const getTenantBySubdomain = async (
  subdomain: string,
): Promise<TenantLookup | null> => {
  // (checkauth)/layout.tsx 의 getMe 와 같은 규칙 — SSR 은 쿠키를 자동으로 싣지 않으므로 직접 넣는다.
  const apiUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3000";
  const proj =
    process.env.PROJECT_NAME || process.env.NEXT_PUBLIC_PROJECT_NAME || "myapp";

  const cookieStore = await cookies();
  const cookieString = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await fetch(
    `${apiUrl}/api/${proj}/v1/tenants/by-subdomain/${encodeURIComponent(subdomain)}`,
    { method: "GET", headers: { Cookie: cookieString } },
  );

  // 404(없는 매장) / 403(권한 없음) 모두 호출부에서 notFound() 로 수렴한다 —
  // 둘을 구분해 보여주면 "존재는 하는데 권한이 없다"가 드러난다.
  if (!response.ok) return null;

  const body = await response.json();
  return (body?.data as TenantLookup) ?? null;
};
