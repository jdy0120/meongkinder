export const AUTH_ROUTES = {
  BASE: "v1/auth",
  SIGNUP: "signup",
  LOGIN: "login",
  LOGOUT: "logout",
  REFRESH: "refresh",
  MYPAGE: "mypage",
  FORGOT_PASSWORD: "forgot-password", // POST: 재설정 링크 이메일 발송
  RESET_PASSWORD: "reset-password", // POST: 토큰 + 새 비밀번호로 재설정

  // 소셜 로그인 (서버 리다이렉트 흐름). `:provider` 는 kakao | naver | discord.
  //   GET /v1/auth/:provider           → provider 인증 페이지로 302
  //   GET /v1/auth/:provider/callback  → code 교환 → 유저 매핑 → JWT 쿠키 → web 으로 302
  SOCIAL_AUTHORIZE: "social/:provider",
  SOCIAL_CALLBACK: "social/:provider/callback",
} as const;
