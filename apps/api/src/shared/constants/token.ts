export const ACCESS_TOKEN_SECRET =
  process.env["ACCESS_JWT_SECRET"] ?? "jwt-access-secret";
export const ACCESS_TOKEN_EXPIRED_IN_SEC =
  Number(process.env["ACCESS_JWT_EXPIRED_SEC"]) || 30 * 60; // 30 minutes
export const ACCESS_TOKEN_EXPIRED_IN_MILL_SEC =
  ACCESS_TOKEN_EXPIRED_IN_SEC * 1000;

export const REFRESH_TOKEN_SECRET =
  process.env["REFRESH_JWT_SECRET"] ?? "jwt-refresh-secret";
export const REFRESH_TOKEN_EXPIRED_IN_SEC =
  Number(process.env["REFRESH_JWT_EXPIRED_SEC"]) || 3 * 24 * 60 * 60; // 3 days
export const REFRESH_TOKEN_EXPIRED_IN_MILL_SEC =
  REFRESH_TOKEN_EXPIRED_IN_SEC * 1000;

export const SIGN_UP_TOKEN_SECRET =
  process.env["SIGN_UP_JWT_SECRET"] ?? "jwt-sign-up-secret";
export const SIGN_UP_TOKEN_EXPIRED_IN_SEC =
  Number(process.env["SIGN_UP_JWT_EXPIRED_SEC"]) || 30 * 60; // 30 minutes
export const SIGN_UP_TOKEN_EXPIRED_IN_MILL_SEC =
  SIGN_UP_TOKEN_EXPIRED_IN_SEC * 1000;
