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
 * `from` 부터 앞으로 세면서 요일 패턴에 해당하는 날짜를 최대 `limit` 개까지 모은다 (job-060).
 *
 * ## 왜 상한이 필요한가
 *
 * 매주 반복(WEEKLY)은 **끝이 없다.** "앞으로 올 정기 등원일이 몇 개인가"라는 수는 존재하지
 * 않으므로, 세는 쪽이 어디서 멈출지를 정해야 한다. 등원 예약 한도에서는 그 상한이 곧
 * **이용권 잔액**이다 — 잔액만큼 세고 나면 그 이상은 답이 달라지지 않는다(어차피 한도 초과).
 *
 * ## 왜 날짜를 하루씩 걷는가
 *
 * 주 단위로 계산하면 빨라지지만, 월말·연말을 넘길 때 경계가 어긋나기 쉽다. 최악의 경우도
 * `7 × limit` 번이고 limit 은 잔액(보통 10~30)이라 실측 비용이 무시할 수준이다. 여기서
 * 빠르기를 사려고 정확도를 내줄 이유가 없다.
 *
 * @param exclude 이미 다른 방식으로 센 날짜(`"YYYY-MM-DD"`). 정기 등원일이면서 보호자가
 *   따로 예약도 잡아 둔 날을 **두 번 세지 않기 위해** 필요하다.
 */
export const upcomingWeekdayDates = (
  weekdays: number[],
  from: Date,
  limit: number,
  exclude: ReadonlySet<string> = new Set(),
): string[] => {
  // 요일이 하나도 없으면 영원히 못 찾는다 — 이 검사가 없으면 무한 루프다.
  if (weekdays.length === 0 || limit <= 0) return [];

  const picked = new Set(weekdays);
  const result: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  // 상한을 못 채우는 경우(요일이 있는데도)는 없지만, 방어적으로 걷는 일수도 묶는다.
  const maxSteps = limit * 7 + 7;

  for (let step = 0; step < maxSteps && result.length < limit; step += 1) {
    if (picked.has(cursor.getDay())) {
      const key = toDateKey(cursor);
      if (!exclude.has(key)) result.push(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
};

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
