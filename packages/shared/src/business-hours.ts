/**
 * 매장 운영시간 — 판정·정규화·표기 (job-060).
 *
 * 런타임 값이므로 `types/contracts/` 가 아니라 여기에 둔다 — contracts 는 타입 전용으로
 * 컴파일 시 통째로 지워지고, 거기 선언한 const 는 조용히 사라진다.
 *
 * 이 파일이 왜 `packages/shared` 에 있는가: 운영시간은 **저장하는 쪽(web 폼)과 판정하는
 * 쪽(API·공개 매장 찾기)이 다르다.** 같은 규칙을 양쪽이 각자 구현하면 특히 경계값에서
 * 갈라진다 — 자정을 넘기는 영업(20:00~02:00), 휴게시간 겹침, "24:00 마감". 갈라지면
 * 화면은 "영업 중"이라 하고 서버는 닫혔다고 하는 상태가 되는데, 그건 보호자가 헛걸음을
 * 한 뒤에야 드러난다.
 *
 * ⚠️ **"지금 영업 중"은 저장하지 않는다.** 조회 시점에 계산한다(job-052 접종 상태와 같은
 * 이유) — 저장하면 시간이 지나도 갱신되지 않아 "닫았는데 영업 중으로 표시되는" 최악의
 * 실패가 난다.
 */

import type {
  BusinessBreak,
  BusinessDay,
  BusinessHours,
} from "../types/contracts/tenant";
import { WEEKDAY_LABELS } from "./pet-schedule";

// ── 요일 ────────────────────────────────────────────────────────────────────
//
// 0=일 ~ 6=토. `Date.getDay()` · `pet-schedule.ts` 의 `WEEKDAY_LABELS` 와 같은 순서다.
// 저장 순서를 굳이 일요일부터로 잡은 이유는 `getDay()` 와 인덱스를 맞추기 위해서다 —
// 화면 순서(월요일부터)와 다르지만, 변환을 한 곳(`WEEK_DISPLAY_ORDER`)에 모아 둔다.

/** 화면에 그리는 순서. 사람은 주를 월요일부터 읽는다. */
export const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * 요일 라벨(0=일 ~ 6=토).
 *
 * `pet-schedule.ts` 의 것을 그대로 쓴다 — 같은 배열을 두 번 선언하면 한쪽만 고쳐졌을 때
 * 등원 스케줄의 "화요일"과 운영시간의 "화요일"이 다른 날을 가리키게 된다.
 */
export const BUSINESS_WEEKDAY_LABELS = WEEKDAY_LABELS;

// ── 시각 표기 ───────────────────────────────────────────────────────────────

/**
 * `"HH:mm"` 24시간 표기. **마감 시각에 한해 `"24:00"`** 을 허용한다.
 *
 * `"24:00"` 이 필요한 이유: 자정에 문을 닫는 매장을 `"00:00"` 으로 쓰면 시작과 같아져
 * "0분 영업"인지 "24시간 영업"인지 구분할 수 없고, `"23:59"` 로 쓰면 1분이 조용히 사라진다.
 * 그래서 마감만 1440분을 표현할 수 있게 열어 둔다 — `"00:00"~"24:00"` 이 곧 24시간 영업이다.
 */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

/** `"HH:mm"` → 자정 기준 분. 형식이 틀리면 `null`(예외를 던지지 않는다 — 검증기가 문구를 만든다). */
export const timeToMinutes = (value: string): number | null => {
  if (!TIME_PATTERN.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour! * 60 + minute!;
};

/** 자정 기준 분 → `"HH:mm"`. 1440 은 `"24:00"` 으로 되돌린다. */
export const minutesToTime = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(1440, Math.round(minutes)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;
};

// ── 기본값 ──────────────────────────────────────────────────────────────────

const closedDay = (day: number): BusinessDay => ({
  day,
  closed: true,
  open: "09:00",
  close: "19:00",
  breaks: [],
});

/**
 * 처음 설정할 때 채워 넣는 시작점 — 평일 09:00~19:00, 주말 휴무.
 *
 * ⚠️ 이것을 **미설정 상태의 기본값으로 쓰면 안 된다.** 아무도 입력한 적 없는 매장을
 * "평일 09~19시 영업"으로 보여주면 그건 거짓말이고, 보호자가 그 말을 믿고 찾아간다.
 * 미설정은 `null` 이며 화면은 "운영시간 미등록"이라고 말해야 한다.
 */
export const createDefaultBusinessHours = (): BusinessHours => ({
  days: [0, 1, 2, 3, 4, 5, 6].map((day) =>
    day === 0 || day === 6
      ? closedDay(day)
      : { day, closed: false, open: "09:00", close: "19:00", breaks: [] },
  ),
  closedOnPublicHolidays: true,
  note: null,
});

// ── 정규화 ──────────────────────────────────────────────────────────────────

const normalizeBreak = (item: BusinessBreak): BusinessBreak => ({
  start: item.start,
  end: item.end,
});

/**
 * 저장 직전에 모양을 맞춘다 — 요일 7개를 0~6 순서로 채우고, 휴무일의 휴게시간을 버리고,
 * 휴게시간을 시작 시각 순으로 정렬한다.
 *
 * 서버가 **반드시** 이걸 거쳐 저장한다. JSONB 는 DB 가 모양을 검사해 주지 않으므로,
 * 여기가 통과하지 못한 값은 어디에도 남지 않는다는 보장이 이 함수 하나에 걸려 있다.
 */
export const normalizeBusinessHours = (input: BusinessHours): BusinessHours => {
  const byDay = new Map<number, BusinessDay>();
  for (const day of input.days ?? []) {
    if (Number.isInteger(day?.day) && day.day >= 0 && day.day <= 6) {
      byDay.set(day.day, day);
    }
  }

  const days = [0, 1, 2, 3, 4, 5, 6].map((index) => {
    const found = byDay.get(index);
    if (!found) return closedDay(index);

    return {
      day: index,
      closed: Boolean(found.closed),
      open: found.open,
      close: found.close,
      // 휴무일에 남은 휴게시간은 버린다. 남겨 두면 요일을 다시 켰을 때 사용자가 지운 줄
      // 알았던 값이 되살아난다.
      breaks: found.closed
        ? []
        : [...(found.breaks ?? [])]
            .map(normalizeBreak)
            .sort(
              (a, b) => (timeToMinutes(a.start) ?? 0) - (timeToMinutes(b.start) ?? 0),
            ),
    } satisfies BusinessDay;
  });

  const note = input.note?.trim();

  return {
    days,
    closedOnPublicHolidays: Boolean(input.closedOnPublicHolidays),
    note: note ? note : null,
  };
};

/**
 * 알 수 없는 값(JSONB 조회 결과·외부 입력)을 계약 모양으로 좁힌다.
 *
 * Prisma 는 JSONB 를 `JsonValue` 로 주므로 계약 타입으로 바로 쓸 수 없고, 예전 행이나
 * 손으로 고친 행이 엉뚱한 모양을 들고 있을 수 있다. 그대로 화면에 넘기면 `days.map` 이
 * 터지면서 매장 설정 화면이 통째로 렌더에 실패한다 — 계약이 진실인지가 유일한 방어선인데
 * JSONB 에는 그 보장이 없으므로 **읽는 쪽에서** 한 번 더 확인한다.
 *
 * 못 알아보는 값은 `null`(= 미설정)로 떨어뜨린다. 부분적으로 살려내면 원장이 넣은 적 없는
 * 시간이 화면에 뜬다.
 */
export const parseBusinessHours = (value: unknown): BusinessHours | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Partial<BusinessHours>;
  if (!Array.isArray(raw.days)) return null;

  const isTime = (time: unknown): time is string =>
    typeof time === "string" && TIME_PATTERN.test(time);

  const days = raw.days.filter(
    (day): day is BusinessDay =>
      Boolean(day) &&
      typeof day === "object" &&
      Number.isInteger((day as BusinessDay).day) &&
      isTime((day as BusinessDay).open) &&
      isTime((day as BusinessDay).close),
  );
  if (days.length === 0) return null;

  return normalizeBusinessHours({
    days: days.map((day) => ({
      ...day,
      breaks: Array.isArray(day.breaks)
        ? day.breaks.filter(
            (item): item is BusinessBreak =>
              Boolean(item) && isTime(item?.start) && isTime(item?.end),
          )
        : [],
    })),
    closedOnPublicHolidays: Boolean(raw.closedOnPublicHolidays),
    note: typeof raw.note === "string" ? raw.note : null,
  });
};

// ── 검증 ────────────────────────────────────────────────────────────────────

/**
 * 사람이 읽을 수 있는 오류 문구 목록. 비어 있으면 통과.
 *
 * 형식(`HH:mm`)은 DTO 의 `@Matches` 가 이미 본다. 여기서 보는 것은 **의미** 다 —
 * 형식은 맞는데 말이 안 되는 조합(마감이 개점보다 빠르지 않은데 같다, 휴게시간이 영업
 * 시간 밖에 있다, 휴게시간끼리 겹친다). 서버가 마지막 방어선이므로 API 를 직접 부르는
 * 경로에서도 같은 검사를 거친다.
 */
export const validateBusinessHours = (hours: BusinessHours): string[] => {
  const errors: string[] = [];

  if (!Array.isArray(hours.days) || hours.days.length === 0) {
    return ["운영시간을 입력해주세요."];
  }

  for (const day of hours.days) {
    if (day.closed) continue;

    const label = BUSINESS_WEEKDAY_LABELS[day.day] ?? "?";
    const open = timeToMinutes(day.open);
    const close = timeToMinutes(day.close);

    if (open === null || close === null) {
      errors.push(`${label}요일 시간 형식이 올바르지 않습니다.`);
      continue;
    }
    if (open === 1440) {
      errors.push(`${label}요일 시작 시각으로 24:00 은 쓸 수 없습니다.`);
      continue;
    }
    if (open === close) {
      errors.push(
        `${label}요일 시작과 종료가 같습니다. 24시간 영업이면 00:00~24:00 으로 입력해주세요.`,
      );
      continue;
    }

    // 마감이 개점보다 이르면 자정을 넘긴 영업으로 읽는다(예: 20:00~02:00, 애견호텔).
    // 그러면 그날의 영업 구간은 [open, close + 1440) 이다.
    const closeAbsolute = close < open ? close + 1440 : close;

    const spans: Array<[number, number]> = [];
    for (const item of day.breaks ?? []) {
      const start = timeToMinutes(item.start);
      const end = timeToMinutes(item.end);

      if (start === null || end === null) {
        errors.push(`${label}요일 휴게시간 형식이 올바르지 않습니다.`);
        continue;
      }
      if (start === end) {
        errors.push(`${label}요일 휴게시간의 시작과 종료가 같습니다.`);
        continue;
      }

      // 휴게시간도 같은 "영업일 시계" 위에 올린다 — 20:00~02:00 영업의 01:00 휴게는
      // 다음 날 01:00 이므로 1440 을 더해야 구간 안에 들어온다. 종료는 시작에 길이를
      // 더해서 구한다(종료가 시작보다 이르면 그 휴게 자체가 자정을 넘긴 것이다).
      const startAbsolute = start < open ? start + 1440 : start;
      const endAbsolute = startAbsolute + (end > start ? end - start : end + 1440 - start);

      if (startAbsolute < open || endAbsolute > closeAbsolute) {
        errors.push(
          `${label}요일 휴게시간이 영업시간(${day.open}~${day.close}) 밖에 있습니다.`,
        );
        continue;
      }

      if (spans.some(([s, e]) => startAbsolute < e && s < endAbsolute)) {
        errors.push(`${label}요일 휴게시간이 서로 겹칩니다.`);
        continue;
      }
      spans.push([startAbsolute, endAbsolute]);
    }
  }

  // 같은 문구가 여러 번 쌓여도 사용자에게는 한 번만 보이면 된다.
  return [...new Set(errors)];
};

// ── "지금 영업 중?" ─────────────────────────────────────────────────────────

export const BUSINESS_STATUS = {
  /** 지금 열려 있다 */
  OPEN: "open",
  /** 열려 있지만 휴게시간이다 */
  BREAK: "break",
  /** 닫혀 있다 */
  CLOSED: "closed",
  /** 매장이 운영시간을 등록하지 않았다 — "닫혔다"와 **다르다** */
  UNKNOWN: "unknown",
} as const;

export type BusinessStatus =
  (typeof BUSINESS_STATUS)[keyof typeof BUSINESS_STATUS];

export const BUSINESS_STATUS_LABEL: Record<BusinessStatus, string> = {
  [BUSINESS_STATUS.OPEN]: "영업 중",
  [BUSINESS_STATUS.BREAK]: "휴게 중",
  [BUSINESS_STATUS.CLOSED]: "영업 종료",
  [BUSINESS_STATUS.UNKNOWN]: "운영시간 미등록",
};

const dayOf = (hours: BusinessHours, index: number): BusinessDay | undefined =>
  hours.days.find((day) => day.day === index);

/**
 * 주어진 요일의 영업 구간을 **오늘 자정 기준 절대 분**으로 편다.
 * `offsetDays` 는 기준일로부터의 날짜 차(어제 = -1)다.
 */
const windowOf = (day: BusinessDay | undefined, offsetDays: number) => {
  if (!day || day.closed) return null;

  const open = timeToMinutes(day.open);
  const close = timeToMinutes(day.close);
  if (open === null || close === null || open === close) return null;

  const base = offsetDays * 1440;
  const start = base + open;
  const end = base + (close < open ? close + 1440 : close);

  const breaks = (day.breaks ?? []).flatMap((item) => {
    const from = timeToMinutes(item.start);
    const to = timeToMinutes(item.end);
    if (from === null || to === null || from === to) return [];

    // 검증기(`validateBusinessHours`)와 **같은 방식으로** 편다. 여기서 어긋나면
    // 저장은 통과했는데 판정만 틀리는, 화면으로는 절대 안 보이는 종류의 버그가 된다.
    const fromAbsolute = base + (from < open ? from + 1440 : from);
    const toAbsolute = fromAbsolute + (to > from ? to - from : to + 1440 - from);
    return [[fromAbsolute, toAbsolute] as const];
  });

  return { start, end, breaks };
};

/**
 * 지금 영업 중인지 판정한다.
 *
 * ⚠️ **어제도 함께 본다.** 자정을 넘겨 영업하는 매장(20:00~02:00)은 새벽 1시에 "오늘"의
 * 시간표만 보면 닫힌 것으로 나오는데, 실제로는 어제 시작한 영업이 아직 돌고 있다.
 */
export const resolveBusinessStatus = (
  hours: BusinessHours | null | undefined,
  now: Date = new Date(),
): BusinessStatus => {
  if (!hours) return BUSINESS_STATUS.UNKNOWN;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const yesterday = (today + 6) % 7;

  const windows = [
    windowOf(dayOf(hours, yesterday), -1),
    windowOf(dayOf(hours, today), 0),
  ];

  for (const window of windows) {
    if (!window) continue;
    if (minutes < window.start || minutes >= window.end) continue;

    const onBreak = window.breaks.some(
      ([from, to]) => minutes >= from && minutes < to,
    );
    return onBreak ? BUSINESS_STATUS.BREAK : BUSINESS_STATUS.OPEN;
  }

  return BUSINESS_STATUS.CLOSED;
};

// ── 표기 ────────────────────────────────────────────────────────────────────

/** 한 요일의 시간을 한 줄로. 예: `"09:00 ~ 19:00 (휴게 13:00~14:00)"` · `"휴무"` */
export const formatBusinessDay = (day: BusinessDay): string => {
  if (day.closed) return "휴무";

  const base = `${day.open} ~ ${day.close}`;
  if (!day.breaks?.length) return base;

  const breaks = day.breaks
    .map((item) => `${item.start}~${item.end}`)
    .join(", ");
  return `${base} (휴게 ${breaks})`;
};

/**
 * 같은 시간표를 쓰는 연속된 요일을 묶어 사람이 읽는 줄로 만든다.
 * 예: `[{ label: "월~금", hours: "09:00 ~ 19:00" }, { label: "토·일", hours: "휴무" }]`
 *
 * 7줄을 그대로 나열하지 않는 이유는, 실제로 매장 대부분이 평일 동일이라 7줄 중 5줄이
 * 같은 말을 반복하기 때문이다. 반복되는 줄은 읽히지 않고, 읽히지 않으면 다른 하루
 * (토요일만 단축 영업 같은)도 같이 안 읽힌다.
 */
export const summarizeBusinessHours = (
  hours: BusinessHours | null | undefined,
): Array<{ label: string; hours: string; closed: boolean }> => {
  if (!hours) return [];

  const groups: Array<{ days: number[]; text: string; closed: boolean }> = [];

  for (const index of WEEK_DISPLAY_ORDER) {
    const day = dayOf(hours, index);
    if (!day) continue;

    const text = formatBusinessDay(day);
    const last = groups[groups.length - 1];

    if (last && last.text === text) {
      last.days.push(index);
    } else {
      groups.push({ days: [index], text, closed: day.closed });
    }
  }

  return groups.map((group) => {
    const labels = group.days.map((day) => BUSINESS_WEEKDAY_LABELS[day]);
    // 3일 이상 이어지면 범위로 줄인다(월~금). 2일이면 범위 표기가 오히려 길다.
    const label =
      group.days.length >= 3
        ? `${labels[0]}~${labels[labels.length - 1]}`
        : labels.join("·");

    return { label, hours: group.text, closed: group.closed };
  });
};

/**
 * 그 날짜에 매장이 문을 여는가 (job-060, 등원 예약 달력).
 *
 * ⚠️ **운영시간을 등록하지 않은 매장(`null`)은 `false`** 다. "모르니까 일단 열어 둔다"로
 * 하면 보호자가 실제로는 닫는 날에 예약을 잡고 아이를 데려온다 — 그 실패는 현관에서
 * 드러나고 되돌릴 수 없다. 대신 화면이 "매장이 운영시간을 등록하지 않아 예약할 수
 * 없습니다"라고 사유를 말해 원장에게 연락할 길을 준다.
 *
 * ⚠️ **자정을 넘긴 영업은 시작한 날의 영업**으로 센다. 월 20:00~02:00 매장에 화요일을
 * 예약할 수는 없다 — 화요일 새벽에 열려 있는 것은 월요일에 시작한 영업이기 때문이다.
 */
export const isOpenOn = (
  hours: BusinessHours | null | undefined,
  date: Date,
): boolean => {
  if (!hours) return false;
  const day = dayOf(hours, date.getDay());
  return Boolean(day && !day.closed);
};

/** 오늘 하루치 표기. 목록·카드에서 한 줄만 보여줄 때 쓴다. */
export const formatTodayHours = (
  hours: BusinessHours | null | undefined,
  now: Date = new Date(),
): string | null => {
  if (!hours) return null;
  const today = dayOf(hours, now.getDay());
  return today ? formatBusinessDay(today) : null;
};
