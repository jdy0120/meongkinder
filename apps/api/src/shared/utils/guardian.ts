/**
 * 보호자 연락처 해석 (job-040).
 *
 * 알림톡/문자는 서비스 계정이 아니라 **전화번호**로 나간다. 그래서 이 서비스는 보호자가
 * 가입하지 않아도 알림을 보낼 수 있고, 그것이 "경쟁 상대는 멍플로우가 아니라 카톡 단톡방"
 * 이라는 포지셔닝의 전제다. 단톡방은 설치도 가입도 요구하지 않는다.
 *
 * 번호가 들어올 수 있는 자리는 두 곳이고, 우선순위가 있다:
 *
 *   1. `Pet.guardianPhone` — 매장이 현장에서 받아 적은 번호. **현장 정보가 우선이다.**
 *      픽업 담당이 계정 주인과 다른 경우(부모 계정 / 실제 등하원은 자녀)가 흔하다.
 *   2. `Pet.user.phone`    — 계정에 등록된 번호. 보호자가 앱에서 직접 아이를 등록하면
 *      guardianPhone 은 선택 입력이라 비어 있기 쉬운데, 폴백이 없으면 **가입까지 한
 *      보호자인데도 알림이 조용히 누락된다.**
 *
 * 둘 다 없으면 null 을 돌려주고, 호출부는 발송을 건너뛰되 그 사실을 로그로 남긴다.
 */
export const resolveGuardianPhone = (pet: {
  guardianPhone?: string | null;
  user?: { phone: string | null } | null;
}): string | null => pet.guardianPhone || pet.user?.phone || null;
