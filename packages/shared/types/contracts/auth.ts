// 인증 도메인 API 계약 (request / response) — 이메일 + 비밀번호 기반
import type { User } from "@template/database";

// ── 요청 ──────────────────────────────────────────────
export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  email: string;
  refreshToken: string;
}

// ── 응답 (data 페이로드) ──────────────────────────────
export interface SignupResponse {
  message: string;
  user: User;
}

// 로그인 성공. access/refresh 토큰은 httpOnly 쿠키로만 내려간다(본문에 토큰 없음).
export interface LoginResponse {
  message: string;
  user: User;
}
