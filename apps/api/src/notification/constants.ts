// 알림 도메인 상수 (Prisma String 컬럼과 일치)

export const NOTIFICATION_TYPE = {
  CHECK_IN: "CHECK_IN", // 등원
  CHECK_OUT_REPORT: "CHECK_OUT_REPORT", // 하원 + 일일 리포트 링크
  REMAINING_COUNT_LOW: "REMAINING_COUNT_LOW", // 정기권/회수권 잔여횟수 임박
  RESERVATION_REMINDER: "RESERVATION_REMINDER", // 다음날 등원 예약 리마인드
  FEED_POST: "FEED_POST", // 피드에 오늘 첫 사진이 올라옴 (job-034)
} as const;

export const NOTIFICATION_CHANNEL = {
  ALIMTALK: "ALIMTALK",
  SMS: "SMS",
} as const;

export const NOTIFICATION_STATUS = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

// 잔여 횟수가 이 값 이하로 떨어지면 "임박" 알림을 발송한다.
export const REMAINING_COUNT_LOW_THRESHOLD = 2;
