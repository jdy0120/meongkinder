export const ATTENDANCE_ROUTES = {
  BASE: "v1/attendances",
  LIST: "", // GET: 출석 기록 목록 (?petId= 로 필터링)
  CREATE: "", // POST: 출석 기록 등록
  GET: ":id", // GET: 상세 조회
  UPDATE: ":id", // PATCH: 등/하원 시각·상태 수정
  DELETE: ":id", // DELETE: 삭제
} as const;

export const DAILY_REPORT_ROUTES = {
  BASE: "v1/daily-reports",
  LIST: "", // GET: 일일 리포트 목록 (?petId= 로 필터링)
  CREATE: "", // POST: 일일 리포트 작성
  GET: ":id", // GET: 상세 조회
  UPDATE: ":id", // PATCH: 리포트 수정
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
