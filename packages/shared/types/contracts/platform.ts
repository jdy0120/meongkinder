// 플랫폼 운영 API 계약 (v1/platform) — pawlog 운영사(SUPER_ADMIN) 전용.
import type { PlatformRole } from "../../src/roles";
import type { SafeUser } from "../models/auth/user";

/**
 * 운영자가 콘솔에서 계정을 직접 발급한다 (job-053).
 *
 * `SignupRequest` 와 두 가지가 다르다:
 *   1) **약관 동의를 받지 않는다.** 동의는 본인만 할 수 있는 행위이므로 대신 눌러주지 않는다.
 *      필수 약관 미동의 상태로 만들어지고, 본인이 처음 `apps/web` 에 들어올 때
 *      최초 진입 게이트(`/welcome`, job-041)가 동의를 받는다.
 *   2) `role` 을 지정할 수 있다 — 운영진(SUPER_ADMIN) 계정 발급이 이 API 의 주 용도다.
 */
export interface CreatePlatformUserRequest {
  email: string;
  password: string;
  nickname: string;
  /** 선택. 매장이 이 번호로 미리 등록해 둔 아이/초대가 있으면 생성 즉시 연결된다. */
  phone?: string;
  /** 생략 시 `USER`. */
  role?: PlatformRole;
}

export interface CreatePlatformUserResponse {
  user: SafeUser;
  /** 전화번호/이메일로 대기 중이던 초대가 몇 건 소속 처리됐는지. */
  claimedInvitations: number;
}
