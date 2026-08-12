/**
 * 테넌트 소속(멤버십) — job-033/034.
 *
 * "내 소속" 계열은 테넌트 컨텍스트 밖(교차 테넌트)에서 호출되고,
 * 구성원 관리 계열은 활성 테넌트 안에서 TENANT_ADMIN 이 호출한다.
 * 고정 경로가 ":id" 보다 먼저 선언되어야 하므로 컨트롤러 선언 순서에 주의한다.
 */
export const MEMBERSHIP_ROUTES = {
  BASE: "v1/memberships",

  // ── 회원 본인 (테넌트 컨텍스트 불필요) ──────────────────────────
  MINE: "mine", // GET:  내가 속한/신청한 테넌트 목록
  APPLY: "apply", // POST: 보호자로 가입 신청 (status=PENDING)
  LEAVE: ":id/leave", // POST: 소속 탈퇴

  // ── 테넌트 관리자 (활성 테넌트 스코프) ──────────────────────────
  LIST: "", // GET:   구성원 목록 (?status=&role= 필터, 페이지네이션)
  DECIDE: ":id/decide", // PATCH: 가입 신청 승인/반려
  UPDATE_ROLE: ":id/role", // PATCH: 구성원 역할 변경
  REMOVE: ":id", // DELETE: 구성원 내보내기
} as const;

/**
 * 초대 — 아직 회원이 아닌 사람을 연락처/아이 정보로 미리 등록해 두는 경로.
 * 상대가 이미 회원이면 초대 대신 곧바로 멤버십이 만들어진다.
 */
export const INVITATION_ROUTES = {
  BASE: "v1/invitations",

  LOOKUP: "lookup", // GET (공개) ?token=: 초대 링크 미리보기
  ACCEPT: "accept", // POST: 로그인 회원이 토큰으로 초대 수락

  CREATE: "", // POST:   (TENANT_ADMIN) 초대 생성
  LIST: "", // GET:    (TENANT_ADMIN) 초대 목록
  CANCEL: ":id", // DELETE: (TENANT_ADMIN) 초대 취소
} as const;
