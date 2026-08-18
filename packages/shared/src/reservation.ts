/**
 * 등원 예약 상수 (job-060).
 *
 * 런타임 값이므로 `types/contracts/` 가 아니라 여기에 둔다 — contracts 는 타입 전용으로
 * 컴파일 시 통째로 지워지고, 거기 선언한 const 는 조용히 사라진다.
 *
 * ## 예약은 이용권을 차감하지 않는다
 *
 * 차감은 지금도, 앞으로도 **등원 체크 한 곳에서만** 일어난다(`AttendanceService`).
 * 예약 시점에 깎으면 두 가지가 동시에 나빠진다:
 *
 *   1. 취소마다 역분개가 필요해지고, 차감 지점이 둘이 되면 반드시 한쪽만 고쳐진다
 *      (job-052 의 `undo-check-in` 이 상태와 차감을 함께 되돌리느라 겪은 그 어려움이다).
 *   2. 예약해 놓고 오지 않은 날이 차감된다 — 실제로 온 날에만 깎여야 한다.
 *
 * 대신 **예약 가능 횟수 = 잔액 − 오늘 이후 예약 수** 로 판정한다. 그래야 10회권으로
 * 30일을 예약해 두는 일이 막히면서도, 돈은 아이가 실제로 온 날에만 움직인다.
 */

/** `PetSchedule.source` — 이 등원일을 누가 넣었는가. */
export const SCHEDULE_SOURCE = {
  /** 원장·스태프가 매장 화면에서 짠 등원일 */
  ADMIN: "ADMIN",
  /** 보호자가 직접 잡은 등원 예약 */
  GUARDIAN: "GUARDIAN",
} as const;

export type ScheduleSource =
  (typeof SCHEDULE_SOURCE)[keyof typeof SCHEDULE_SOURCE];

/**
 * 그 날짜를 예약할 수 없는 이유.
 *
 * ⚠️ **날짜를 그냥 비활성화하고 끝내지 않는다.** 달력에서 눌리지 않는 날은 사용자에게
 * 전부 똑같아 보이는데, 실제 이유는 "매장이 쉬는 날"과 "이용권이 없다"처럼 대응 방법이
 * 완전히 다르다. 전자는 다른 날을 고르면 되고 후자는 이용권을 사야 한다 — 사유를 말해
 * 주지 않으면 보호자는 앱이 고장 났다고 판단하고 매장에 전화한다.
 */
export const RESERVATION_BLOCK = {
  /** 지난 날짜 (오늘 포함하지 않음 — 오늘 예약은 허용한다) */
  PAST: "PAST",
  /** 요일 시간표상 쉬는 날 (매주 그 요일은 안 연다) */
  CLOSED: "CLOSED",
  /**
   * **그 날 하루만** 쉰다 — 임시 휴무 (job-060).
   *
   * `CLOSED` 와 나눈 이유는 보호자가 읽는 뜻이 다르기 때문이다. "일요일은 원래 휴무"와
   * "9월 16일은 설 연휴라 쉼"은 다음에 어떻게 할지가 다르고, 후자는 **사유를 함께
   * 보여줄 수 있다**(매장이 적어 둔 문구).
   */
  TEMPORARILY_CLOSED: "TEMPORARILY_CLOSED",
  /** 매장이 운영시간을 등록하지 않아 어느 날이 운영일인지 알 수 없다 */
  NO_BUSINESS_HOURS: "NO_BUSINESS_HOURS",
  /** 이미 예약(또는 원장이 지정)된 날 */
  ALREADY: "ALREADY",
  /** 이용권 잔액이 0이다 */
  NO_BALANCE: "NO_BALANCE",
  /**
   * 잔액은 남았지만 **이미 잡힌 등원 예정일이 그 잔액을 다 쓴다** (job-060).
   *
   * `NO_BALANCE` 와 나눈 이유는 보호자가 할 일이 다르기 때문이다. 잔액 0은 충전만이
   * 답이지만, 이쪽은 "정기 등원일을 줄이거나 예약을 취소하면" 자리가 난다 — 둘을 같은
   * 문구로 묶으면 이미 10회권을 산 사람에게 "이용권이 없습니다"라고 말하게 된다.
   */
  SCHEDULE_FULL: "SCHEDULE_FULL",
  /** 아이가 아직 어느 유치원에도 등록되어 있지 않다 */
  NOT_ENROLLED: "NOT_ENROLLED",
} as const;

export type ReservationBlock =
  (typeof RESERVATION_BLOCK)[keyof typeof RESERVATION_BLOCK];

export const RESERVATION_BLOCK_LABEL: Record<ReservationBlock, string> = {
  [RESERVATION_BLOCK.PAST]: "지난 날짜",
  [RESERVATION_BLOCK.CLOSED]: "휴무일",
  [RESERVATION_BLOCK.TEMPORARILY_CLOSED]: "임시 휴무",
  [RESERVATION_BLOCK.NO_BUSINESS_HOURS]: "운영시간 미등록",
  [RESERVATION_BLOCK.ALREADY]: "이미 등원 예정",
  [RESERVATION_BLOCK.NO_BALANCE]: "남은 이용권 없음",
  [RESERVATION_BLOCK.SCHEDULE_FULL]: "이용권 모두 예정됨",
  [RESERVATION_BLOCK.NOT_ENROLLED]: "유치원 미등록",
};

/**
 * 한도(잔액) 때문에 막힌 사유들.
 *
 * 화면은 **아직 보내지 않은 선택**을 반영해 이 사유들만 다시 계산한다 — 서버의 판정은
 * 사용자가 방금 달력에서 고른 3일을 모르기 때문이다. 나머지 사유(휴무일·지난 날짜)는
 * 선택과 무관하므로 서버 판정을 그대로 쓴다.
 */
export const QUOTA_BLOCKS: readonly ReservationBlock[] = [
  RESERVATION_BLOCK.NO_BALANCE,
  RESERVATION_BLOCK.SCHEDULE_FULL,
];

/** 사용자에게 그대로 보여줄 안내 문구 — 라벨보다 길고, 무엇을 하면 되는지 말한다. */
export const RESERVATION_BLOCK_MESSAGE: Record<ReservationBlock, string> = {
  [RESERVATION_BLOCK.PAST]: "지난 날짜는 예약할 수 없습니다.",
  [RESERVATION_BLOCK.CLOSED]: "이 날은 유치원이 쉬는 날입니다.",
  [RESERVATION_BLOCK.TEMPORARILY_CLOSED]: "이 날은 유치원이 임시 휴무입니다.",
  [RESERVATION_BLOCK.NO_BUSINESS_HOURS]:
    "유치원이 아직 운영시간을 등록하지 않아 예약할 수 없습니다. 유치원에 문의해주세요.",
  [RESERVATION_BLOCK.ALREADY]: "이미 등원 예정인 날입니다.",
  [RESERVATION_BLOCK.NO_BALANCE]:
    "남은 이용권이 없습니다. 유치원에서 이용권을 충전해주세요.",
  [RESERVATION_BLOCK.SCHEDULE_FULL]:
    "이미 예정된 등원일로 남은 이용권이 모두 사용될 예정입니다. 예약을 취소하거나 이용권을 충전한 뒤 추가할 수 있습니다.",
  [RESERVATION_BLOCK.NOT_ENROLLED]:
    "아이가 아직 유치원에 등록되어 있지 않습니다. 먼저 유치원에 가입 신청해주세요.",
};
