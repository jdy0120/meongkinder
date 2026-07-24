import type { CookieOptions } from "express";

/**
 * 환경(dev/prod) 및 COOKIE_DOMAIN/SERVER_NAME 설정에 따른 표준 CookieOptions 반환
 * - domain이 지정되지 않은 경우, NODE_ENV === "production"이고 SERVER_NAME이 설정되어 있으면
 *   서브도메인(admin.xxx, www.xxx) 간 쿠키 공유를 위해 `.${SERVER_NAME}` 형태의 도메인을 자동 적용합니다.
 * - SameSite는 서브도메인 간 API 통신 및 페이지 이동 시 쿠키 유실을 막기 위해 기본값 "lax"를 사용합니다.
 */
export const getCookieName = (base: "access_token" | "refresh_token"): string => {
  const prefix = process.env.PROJECT_NAME;
  return prefix ? `${prefix}_${base}` : base;
};

export const getCookieOptions = (
  sameSite: "strict" | "lax" | "none" = "lax",
): CookieOptions => {
  const isProd = process.env.NODE_ENV === "production";
  const domain =
    process.env.COOKIE_DOMAIN ||
    (isProd && process.env.SERVER_NAME
      ? `.${process.env.SERVER_NAME}`
      : undefined);

  return {
    httpOnly: true,
    secure: isProd,
    sameSite,
    ...(domain ? { domain } : {}),
  };
};
