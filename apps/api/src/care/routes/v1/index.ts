export const ATTENDANCE_ROUTES = {
  BASE: "v1/attendances",
  LIST: "", // GET: 출석 기록 목록 (?petId= 로 필터링)
  CREATE: "", // POST: 출석 기록 등록
  TODAY: "today", // GET: 오늘의 출석부 조회 (요일 스케줄 기반, 페이지네이션)
  // job-046: 보호자 - 내 아이 등원 이력. ":id" 보다 먼저 선언되어야 한다.
  MY_LIST: "mine", // GET: 본인 소유 아이의 출석 이력 (?petId= 필터)
  CHECK_IN: ":id/check-in", // POST: 등원 체크
  // job-052: 등원 되돌리기. 화면 상태만이 아니라 **이용권 차감까지** 되돌린다
  // (design-system.md §3.2 — 오터치는 막지 말고 되돌릴 수 있게).
  UNDO_CHECK_IN: ":id/undo-check-in", // POST: 등원 취소
  CHECK_OUT: ":id/check-out", // POST: 하원 체크
  STATUS: ":id/status", // PATCH: 결석/보강 처리 + 정기권 차감 여부 선택
  GET: ":id", // GET: 상세 조회
  UPDATE: ":id", // PATCH: 등/하원 시각·상태 수정
  DELETE: ":id", // DELETE: 삭제
} as const;

export const DAILY_REPORT_ROUTES = {
  BASE: "v1/daily-reports",
  LIST: "", // GET: 일일 리포트 목록 (?petId= 로 필터링, 페이지네이션)
  CREATE: "", // POST: 일일 리포트 작성 (사진/식사/배변/낮잠/활동/특이사항 항목 일괄 입력 + AI 코멘트 초안 자동 생성)
  MY_LIST: "mine", // GET: 보호자 - 본인 소유 반려동물의 발행(PUBLISHED)된 리포트 목록 (?petId=, ?date= 필터, 페이지네이션). ":id" 보다 먼저 매칭되어야 함
  MY_DETAIL: "mine/:id", // GET: 보호자 - 리포트 상세 (본인 소유 확인, 발행된 리포트만)
  // job-040: 로그인 없이 여는 공개 알림장. 알림톡을 받은 미가입 보호자가 이 경로로 본다.
  // 고정 경로이므로 ":id" 보다 먼저 선언되어야 한다.
  SHARED: "shared", // GET (@Public): ?token= 서명 토큰으로 알림장 1건 조회
  GET: ":id", // GET: 상세 조회 (항목 포함)
  UPDATE: ":id", // PATCH: 리포트 수정 (contents 전달 시 항목 대체 + AI 코멘트 초안 재생성)
  DELETE: ":id", // DELETE: 삭제
} as const;

export const REPORT_CONTENT_ROUTES = {
  BASE: "v1/daily-reports/:dailyReportId/contents",
  LIST: "", // GET: 리포트 항목 목록
  CREATE: "", // POST: 리포트 항목 추가
  GET: ":id", // GET: 항목 상세
  UPDATE: ":id", // PATCH: 항목 수정
  DELETE: ":id", // DELETE: 항목 삭제
} as const;
