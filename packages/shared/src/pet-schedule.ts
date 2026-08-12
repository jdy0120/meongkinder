/**
 * 등원 스케줄 상수/헬퍼 (job-053).
 *
 * 런타임 값이므로 `types/contracts/` 가 아니라 여기에 둔다 — contracts 는 타입 전용으로
 * 컴파일 시 통째로 지워지고, 거기 선언한 const 는 조용히 사라진다.
 *
 * ⚠️ **날짜는 언제나 `"YYYY-MM-DD"` 문자열로 주고받는다.** `Date` 를 JSON 에 실으면
 * `toISOString()` 이 UTC 로 바꿔 KST 자정이 전날로 밀린다 — 등원일이 하루씩 어긋나는데
 * 화면은 멀쩡해 보이고 출석부만 틀린다. 서버의 `@db.Date` 컬럼과도 이 표기가 맞다.
 */

export const SCHEDULE_TYPE = {
  /** 매주 같은 요일 반복. `scheduleDays` 가 진실이고 달이 바뀌어도 이어진다. */
  WEEKLY: "WEEKLY",
  /** 그 달 달력에서 고른 날짜만. `PetSchedule` 행이 진실이고 다음 달은 비어 있다. */
  MONTHLY: "MONTHLY",
} as const;

export type ScheduleType = (typeof SCHEDULE_TYPE)[keyof typeof SCHEDULE_TYPE];

export const SCHEDULE_TYPES = Object.values(SCHEDULE_TYPE);

export const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  [SCHEDULE_TYPE.WEEKLY]: "매주 반복",
  [SCHEDULE_TYPE.MONTHLY]: "날짜 지정",
};

/** 0=일 ~ 6=토. 화면의 요일 토글과 `Pet.scheduleDays` 가 같은 순서를 쓴다. */
export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * `Date` → `"YYYY-MM-DD"` (로컬 타임존 기준).
 *
 * `toISOString().slice(0, 10)` 을 쓰면 안 된다 — KST 2026-08-07 00:00 이 UTC 로는
 * 2026-08-06 15:00 이라 **하루 전 날짜**가 나온다.
 */
export const toDateKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/** `"YYYY-MM-DD"` → 로컬 자정 `Date`. `new Date("2026-08-07")` 은 UTC 로 파싱된다. */
export const fromDateKey = (key: string): Date => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
};

/** `"YYYY-MM"` 한 달의 [시작일, 다음 달 1일) 반경계 구간. */
export const monthRange = (year: number, month: number) => ({
  start: new Date(year, month - 1, 1),
  end: new Date(year, month, 1),
});

/**
 * 그 달에서 주어진 요일들에 해당하는 날짜 전부 — 달력의 "요일로 채우기" 버튼용.
 *
 * 계산을 화면과 서버가 따로 구현하지 않도록 여기 둔다. 갈라지면 원장이 채운 달력과
 * 실제 출석부가 서로 다른 날을 가리키는데, 그건 눌러 보기 전까지 드러나지 않는다.
 */
export const datesOfWeekdaysInMonth = (
  year: number,
  month: number,
  weekdays: number[],
): string[] => {
  if (weekdays.length === 0) return [];

  const picked = new Set(weekdays);
  const result: string[] = [];
  const cursor = new Date(year, month - 1, 1);

  while (cursor.getMonth() === month - 1) {
    if (picked.has(cursor.getDay())) result.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
};
