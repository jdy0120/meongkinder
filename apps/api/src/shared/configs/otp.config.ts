// 휴대폰 본인확인(OTP) 설정 — job-042.
//
// 이 서비스에서 전화번호는 연락처가 아니라 **열쇠**다. 번호 하나로 그 번호에 묶인
// 원생·알림장·사진의 소유권이 넘어간다(`InvitationService.claimForUser`). 그래서
// "번호를 입력했다"와 "그 번호의 주인이다"를 구분하는 것이 이 설정의 목적이다.

export const otpConfig = {
  /** 자릿수. 6자리는 문자 한 통에 들어가고 사람이 한 번에 읽는 길이다. */
  length: 6,

  /** 코드 유효시간(초). 짧으면 재발송이 잦고, 길면 탈취 창이 커진다. */
  ttlSec: Number(process.env.OTP_TTL_SEC ?? 300),

  /**
   * 검증 완료 표시의 유효시간(초).
   *
   * 코드를 맞힌 뒤 실제로 저장 버튼을 누르기까지의 시간이다. 약관 게이트처럼 다른 입력이
   * 함께 있는 화면을 고려해 코드 자체보다 길게 준다.
   */
  verifiedTtlSec: Number(process.env.OTP_VERIFIED_TTL_SEC ?? 600),

  /**
   * 같은 코드에 대한 시도 한도. 초과하면 코드를 폐기한다.
   *
   * 6자리는 100만분의 1이지만, 무제한 시도를 허용하면 그 숫자는 의미가 없다.
   */
  maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),

  /** 재발송 최소 간격(초). 연타로 문자 폭탄이 되는 것을 막는다(수신자는 비용을 안 낸다). */
  resendCooldownSec: Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 30),

  /** 한 번호에 하루 몇 통까지. 발송 원가가 있고, 남의 번호를 괴롭히는 데 쓰일 수 있다. */
  dailyLimitPerPhone: Number(process.env.OTP_DAILY_LIMIT ?? 10),

  /**
   * ⚠️ 임시 탈출구 — **본인확인 없이 전화번호 저장을 허용한다.**
   *
   * job-056 의 `ALLOW_UNPAID_TENANT_SEAT` 와 같은 성격이다. Solapi 발신번호 등록이
   * 끝나지 않았거나 로컬에서 문자를 받을 수 없을 때 흐름을 끝까지 돌려보기 위한 것이고,
   * 켜져 있는 동안은 **job-042 의 취약점이 그대로 열려 있다.**
   *
   * 켜져 있으면 매 부팅마다 경고를 남긴다(main.ts).
   */
  allowUnverified: process.env.ALLOW_UNVERIFIED_PHONE === "true",
} as const;
