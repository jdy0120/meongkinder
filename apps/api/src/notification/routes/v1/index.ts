export const NOTIFICATION_ROUTES = {
  BASE: "v1/notifications",
  LIST: "", // GET: 알림 발송 내역 목록 (?userId=&petId=&type=&status= 필터, 페이지네이션)
  GET: ":id", // GET: 발송 내역 상세 조회
} as const;
