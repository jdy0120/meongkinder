export const AUTH_ROUTES = {
  BASE: "v1/auth",
  SIGNUP: "signup",
  LOGIN: "login",
  LOGOUT: "logout",
  REFRESH: "refresh",
  MYPAGE: "mypage",
  FORGOT_PASSWORD: "forgot-password", // POST: 재설정 링크 이메일 발송
  RESET_PASSWORD: "reset-password", // POST: 토큰 + 새 비밀번호로 재설정
} as const;
