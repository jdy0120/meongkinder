// 인증 도메인 API 계약 (request / response) — 이메일 + 비밀번호 기반
import type { User } from "@pawlog/database";
import type { TermsAgreementInput } from "./terms";
import type { SocialProvider } from "../../src/social";

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

// ── 소셜 로그인 ───────────────────────────────────────
// provider 별로 응답 구조가 제각각인 원본을, 각 전략(정규화 경계)에서 아래 공통 형태로 변환한다.
// 이 타입 아래(서비스·응답·프론트)에서는 provider 를 구별하지 않는다.
export interface NormalizedSocialProfile {
  provider: SocialProvider;
  providerAccountId: string; // provider 고유 id (항상 string)
  email: string | null; // provider 가 이메일을 주지 않을 수 있어 nullable
  nickname: string | null;
  avatarUrl: string | null;
}

// 소셜 로그인 성공 — 이메일 로그인과 동일하게 access/refresh 토큰은 httpOnly 쿠키로만 내려간다.
// 서버 리다이렉트 흐름이므로 실제 응답은 web 으로의 302 redirect 이며, 이 타입은 내부 처리 결과를 기술한다.
export interface SocialLoginResult {
  user: User;
  isNewUser: boolean;
}
