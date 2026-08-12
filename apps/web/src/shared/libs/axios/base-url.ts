/**
 * API 주소 조립의 **단일 출처**.
 *
 * ⚠️ `getBaseUrl()` 이 돌려주는 값에는 이미 `/api/<project>` 프리픽스가 들어 있다
 * (NestJS 의 `app.setGlobalPrefix(`api/${PROJECT_NAME}`)` 와 짝을 이룬다).
 * 여기에 프리픽스를 한 번 더 붙이면 `/api/<p>/api/<p>/…` 가 되어 404 가 난다.
 *
 * 실제로 인터셉터의 refresh/logout 호출이 정확히 그 모양이었고, 그래서
 * **액세스 토큰이 만료되면 재발급을 시도해도 무조건 실패해 곧장 로그아웃**됐다.
 * 404 는 인터셉터 안에서 조용히 `false` 로 삼켜지므로 화면에는 "로그인 풀림"
 * 하나로만 보인다 — 경로를 손으로 잇지 말고 반드시 `apiUrl()` 을 쓸 것.
 */

const getProjectName = () => {
  if (typeof window === "undefined") {
    return (
      process.env.PROJECT_NAME ||
      process.env.NEXT_PUBLIC_PROJECT_NAME ||
      "myapp"
    );
  }
  return process.env.NEXT_PUBLIC_PROJECT_NAME || "myapp";
};

const getApiOrigin = () => {
  if (typeof window === "undefined") {
    return (
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3000"
    );
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
};

/** 프리픽스까지 포함한 API 베이스 (예: `https://host/api/pawlog-dev`) */
const getBaseUrl = () => `${getApiOrigin()}/api/${getProjectName()}`;

/** 라우트 경로(`/v1/auth/refresh`)를 절대 URL 로. 프리픽스는 여기서만 붙는다. */
const apiUrl = (path: string) =>
  `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

export { apiUrl, getApiOrigin, getBaseUrl, getProjectName };
