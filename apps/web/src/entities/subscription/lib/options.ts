/** 구독(정기권/회수권) 상태 코드 ↔ 라벨 */
export const subscriptionStatusLabelMap: Record<string, string> = {
  ACTIVE: "이용중",
  CANCELED: "해지예정",
  EXPIRED: "만료",
  FAIL_PAUSED: "결제실패(보류)",
  PAUSED: "일시정지",
};

/** 요금제 유형 코드 ↔ 라벨 */
export const planTypeLabelMap: Record<string, string> = {
  RECURRING: "정기결제",
  COUNT: "회수권",
  UNLIMITED: "기간 무제한",
  PERIOD: "기간제",
};

/** 정기권/회수권 사용 내역 변동 유형 코드 ↔ 라벨 */
export const ledgerTypeLabelMap: Record<string, string> = {
  CHARGE: "충전",
  USE: "사용",
  REFUND: "환불/복구",
  EXPIRE: "소멸",
  // job-063: 잔액 0인데 등원해서 차감하지 못한 날. "사용"과 같은 말로 적으면 원장이
  // 이용권을 쓴 것으로 읽어 미수가 보이지 않는다.
  UNPAID_USE: "미차감 이용",
};
