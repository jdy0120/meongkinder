import { NextResponse, type NextRequest } from "next/server";
import { apiUrl, getProjectName } from "@/shared/libs/axios/base-url";

/**
 * 액세스 토큰 **무중단 재발급**.
 *
 * 왜 여기여야 하는가: `(checkauth)/layout.tsx` 는 매 요청 `getMe()` 를 부르고
 * 401 이면 곧장 `/auth/login` 으로 보낸다. 그 사이에 재발급을 끼워 넣을 자리가
 * 레이아웃 안에는 **없다** — Server Component 렌더 중에는 쿠키를 쓸 수 없어서,
 * refresh 응답의 `Set-Cookie` 를 받아도 브라우저에 심을 방법이 없기 때문이다.
 * 그래서 액세스 토큰이 만료된 뒤 첫 페이지 이동에서는 클라이언트 인터셉터가
 * 실행될 기회조차 없이 로그아웃됐다. 프록시는 렌더 이전에 돌면서 응답 헤더를
 * 만질 수 있는 유일한 지점이다.
 *
 * 여기서 하는 일은 **갱신뿐이고, 판단은 하지 않는다.** 재발급이 실패해도
 * 리다이렉트하지 않고 그대로 흘려보낸다 — 누가 들어갈 수 있는지는 레이아웃과
 * 서버 가드(`TenantMiddleware`/`RolesGuard`)가 정한다. 프록시가 인증 판단까지
 * 겸하면 규칙이 두 곳으로 갈라지고, 그때부터 둘 중 어느 쪽이 진짜인지 알 수 없다.
 */

const ACCESS_COOKIE = `${getProjectName()}_access_token`;
const REFRESH_COOKIE = `${getProjectName()}_refresh_token`;

/**
 * 같은 리프레시 토큰에 대한 동시 재발급을 하나로 묶는다.
 *
 * 서버는 재발급 때마다 토큰을 **회전**시키고 이전 토큰을 Redis 에서 무효화한다
 * (`AuthService.refresh`). 따라서 같은 토큰으로 두 번 부르면 둘 중 하나는 반드시
 * 401 이 되어, 고치려던 로그아웃을 오히려 프록시가 만들어낸다. 한 번의 화면 이동이
 * 여러 요청(문서 + RSC 프리페치)을 동시에 띄우므로 이건 가정이 아니라 기본 동작이다.
 *
 * ⚠️ 키는 반드시 **리프레시 토큰 값**이다. 프로세스 하나가 모든 사용자를 처리하므로
 * 전역 단일 프라미스로 묶으면 A 의 재발급 결과(Set-Cookie)가 B 에게 나간다.
 *
 * 참고로 "프리페치 요청은 건너뛴다" 는 방식은 **불가능하다** — Next 는 프록시를
 * 부르기 전에 `RSC`/`Next-Router-Prefetch` 등 FLIGHT_HEADERS 를 요청에서 제거한다
 * (`next/dist/server/web/adapter.js`: "Headers should only be stripped for
 * middleware"). 프록시에서는 프리페치인지 알 방법이 없으므로, 구분하는 대신
 * 여기서 합치는 것이 유일한 방어다.
 */
const inFlight = new Map<string, Promise<string[]>>();

const refresh = (cookieHeader: string, key: string): Promise<string[]> => {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const pending = fetch(apiUrl("/v1/auth/refresh"), {
    method: "POST",
    headers: { cookie: cookieHeader },
    cache: "no-store",
  })
    .then((res) => (res.ok ? readSetCookies(res.headers) : []))
    .catch(() => [])
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, pending);
  return pending;
};

/** `Set-Cookie` 는 여러 줄로 오므로 합쳐진 문자열이 아니라 배열로 읽어야 한다. */
const readSetCookies = (headers: Headers): string[] => {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
};

/** `name=value; Path=/; HttpOnly` → `["name", "value"]` (값에 `=` 가 있어도 안전) */
const parseNameValue = (setCookie: string): [string, string] | null => {
  const pair = setCookie.split(";", 1)[0] ?? "";
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  return [pair.slice(0, eq).trim(), pair.slice(eq + 1).trim()];
};

const proxy = async (request: NextRequest) => {
  // 액세스 쿠키가 아직 살아 있으면 할 일이 없다. 쿠키의 maxAge 가 토큰 만료와 같이
  // 설정되므로(`auth.controller.ts`), "쿠키가 사라졌다" 가 곧 "토큰이 만료됐다" 다.
  // 리프레시 쿠키까지 없으면 비로그인 상태이므로 역시 그냥 통과시킨다.
  const hasAccess = request.cookies.has(ACCESS_COOKIE);
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (hasAccess || !refreshToken) return NextResponse.next();

  const cookieHeader = request.headers.get("cookie") ?? "";
  const setCookies = await refresh(cookieHeader, refreshToken);
  if (setCookies.length === 0) return NextResponse.next();

  // ① 이번 요청이 **이미 진행 중**이므로, 새 토큰을 하류(레이아웃의 getMe)로도
  //    넘겨줘야 한다. 응답 쿠키만 심으면 브라우저는 다음 요청부터 새 토큰을 쓰지만
  //    지금 이 요청의 레이아웃은 여전히 만료된 토큰으로 401 을 받아 로그인으로 튄다.
  //    즉 이 한 줄이 빠지면 "로그인이 한 번 풀렸다가 돌아온다".
  for (const setCookie of setCookies) {
    const parsed = parseNameValue(setCookie);
    if (parsed) request.cookies.set(parsed[0], parsed[1]);
  }
  const headers = new Headers(request.headers);
  headers.set("cookie", request.cookies.toString());

  const response = NextResponse.next({ request: { headers } });

  // ② 브라우저에는 API 가 내려준 `Set-Cookie` 를 **그대로** 전달한다.
  //    domain/httpOnly/secure/maxAge 를 여기서 다시 조립하면 서버의
  //    `getCookieOptions()` 와 갈라져, 서브도메인 간 쿠키 공유가 조용히 깨진다.
  for (const setCookie of setCookies) {
    response.headers.append("set-cookie", setCookie);
  }

  return response;
};

export default proxy;

export const config = {
  // 정적 자산은 인증과 무관하므로 제외한다 — 포함하면 페이지 한 장에
  // 수십 번 재발급을 시도하게 된다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
