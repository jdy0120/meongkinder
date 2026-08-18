// 인증 도메인 API 계약 (request / response) — 이메일 + 비밀번호 기반
import type { TermsAgreementInput } from "./terms";
import type { SocialProvider } from "../../src/social";
import type { SafeUser } from "../models/auth/user";

// ── 요청 ──────────────────────────────────────────────
export interface SignupRequest {
  phone?: string; // 휴대폰 번호 (선택). 대기 중인 테넌트 초대와 매칭하는 키로 쓰인다.
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

/**
 * 최초 진입 완료 (job-041) — 필수 약관 동의 + (선택) 전화번호.
 *
 * 카카오 로그인은 약관 동의를 거치지 않아 `apps/web` 사용자는 전원 미동의 상태로
 * 계정이 만들어진다. 이 요청이 그 구멍을 메우는 유일한 경로다.
 */
export interface CompleteProfileRequest {
  agreements: TermsAgreementInput[];
  /** 선택. 넣으면 비회원 시절 등록된 아이·매장이 연결된다(생략 시 연결 불가). */
  phone?: string;
}

/** 아직 동의하지 않은 활성 필수 약관 — 게이트 화면이 이 목록을 그대로 렌더한다. */
export interface PendingRequiredTerms {
  id: string;
  title: string;
  type: string;
  version: string;
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
  user: SafeUser;
}

// 로그인 성공. access/refresh 토큰은 httpOnly 쿠키로만 내려간다(본문에 토큰 없음).
export interface LoginResponse {
  user: SafeUser;
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
  user: SafeUser;
  isNewUser: boolean;
}

// ── 휴대폰 본인확인 (job-042) ──────────────────────────
//
// 이 서비스에서 전화번호는 연락처가 아니라 **소유권의 열쇠**다. 매장이 미가입 보호자의
// 아이를 번호로 등록해 두고(job-040), 그 번호로 가입한 사람에게 아이·알림장·사진이
// 넘어간다(claimForUser). 번호가 자기신고인 동안은 **남의 번호를 입력하는 것만으로
// 남의 아이 기록에 접근**할 수 있었고, OTP 가 닫는 것이 정확히 그 한 칸이다.
//
// 채널은 SMS 다. 증명하려는 것이 번호의 소유이므로, 카카오 *계정*에 도달하는 알림톡은
// 한 단계 우회이고 실패 시 결국 SMS 폴백이 필요하다.

export interface RequestPhoneOtpRequest {
  phone: string; // 하이픈 허용 — 서버가 숫자만 남긴다
}

export interface RequestPhoneOtpResponse {
  /** 이 시간(초) 안에 입력해야 한다. 화면의 카운트다운이 이 값을 쓴다. */
  expiresInSec: number;
}

export interface VerifyPhoneOtpRequest {
  phone: string;
  code: string;
}

export interface VerifyPhoneOtpResponse {
  verified: true;
}
