// 인증 도메인 API 계약 (request / response) — 이메일 + 비밀번호 기반
import type { User } from "@template/database";
import type { TermsAgreementInput } from "./terms";

// ── 요청 ──────────────────────────────────────────────
export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
  agreements?: TermsAgreementInput[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  email: string;
  refreshToken: string;
}

// 비밀번호 찾기 — 재설정 링크(토큰)를 이메일로 발송
export interface ForgotPasswordRequest {
  email: string;
}

// 비밀번호 재설정 — 이메일 링크의 토큰 + 새 비밀번호
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

// ── 응답 (data 페이로드) ──────────────────────────────
// 성공 message 는 BaseResponse.message(봉투)에 담긴다. 아래 타입은 data 페이로드만 기술.
export interface SignupResponse {
  user: User;
}

// 로그인 성공. access/refresh 토큰은 httpOnly 쿠키로만 내려간다(본문에 토큰 없음).
export interface LoginResponse {
  user: User;
}

// 비밀번호 찾기/재설정 공통 — data 페이로드 없음(null). 안내 message 는 봉투(BaseResponse.message)에 담긴다.
export type MessageResponse = null;
