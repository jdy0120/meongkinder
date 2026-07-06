// 인증 도메인 API 계약 (request / response)
import type { User } from "@template/database";

// ── 요청 ──────────────────────────────────────────────
export interface LoginRequest {
  email: string;
}

export interface SubmitOtpRequest {
  email: string;
  otpToken: string;
}

export interface RefreshRequest {
  email: string;
  refreshToken: string;
}

// ── 응답 (data 페이로드) ──────────────────────────────
// access/refresh 토큰은 httpOnly 쿠키로 내려가므로 본문에는 없습니다.
export interface LoginResponse {
  message: string;
}

export interface SubmitOtpResponse {
  message: string;
  user: User;
}
