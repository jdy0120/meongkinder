export const AUTH_ROUTES = {
  BASE: "v1/auth",
  SIGNUP: "signup",
  LOGIN: "login",
  LOGOUT: "logout",
  REFRESH: "refresh",
  MYPAGE: "mypage",
  UPDATE_PROFILE: "me", // PATCH: 내 정보 수정 (닉네임·전화번호)
  // job-041: 최초 진입 게이트. 필수 약관 동의(강제) + 전화번호(선택, 넣으면 비회원 시절
  // 데이터 연결). 카카오 로그인이 약관 동의를 건너뛰므로 web 사용자는 전원 여기를 지난다.
  COMPLETE_PROFILE: "complete-profile", // POST

  // job-042: 휴대폰 본인확인. 번호가 소유권의 열쇠라(claimForUser) "번호를 안다"와
  // "그 번호를 지금 쥐고 있다"를 구분해야 한다. 채널은 SMS — 증명 대상이 번호의 소유다.
  REQUEST_PHONE_OTP: "phone/otp", // POST: 인증번호 발송
  VERIFY_PHONE_OTP: "phone/otp/verify", // POST: 인증번호 확인
  FORGOT_PASSWORD: "forgot-password", // POST: 재설정 링크 이메일 발송
  RESET_PASSWORD: "reset-password", // POST: 토큰 + 새 비밀번호로 재설정

  // 소셜 로그인 (서버 리다이렉트 흐름). job-036 이후 `:provider` 는 kakao 뿐이다.
  //   GET /v1/auth/:provider           → provider 인증 페이지로 302
  //   GET /v1/auth/:provider/callback  → code 교환 → 유저 매핑 → JWT 쿠키 → web 으로 302
  SOCIAL_AUTHORIZE: "social/:provider",
  SOCIAL_CALLBACK: "social/:provider/callback",
} as const;
