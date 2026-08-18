/**
 * 피드의 날짜 축 유틸.
 *
 * `FeedPost.date` / `Attendance.date` 는 모두 `@db.Date` 라 시각 성분이 없어야 한다.
 * 정규화 규칙은 `shared/utils/date.ts` 하나뿐이다 — **한국 달력 날짜의 UTC 자정**.
 * 여기서 따로 계산하면 "오늘의 커버리지"와 출석부가 서로 다른 하루를 보게 된다.
 */
import { startOfKstDay, toKstDateString } from "../../shared/utils";

/**
 * 그 날짜의 00:00 (미지정 시 오늘) — 한국 달력 기준.
 *
 * 입력이 `"2026-08-18"` 같은 날짜 문자열이든 특정 시점이든, 그것이 속한 한국 달력
 * 날짜로 정규화된다.
 */
export const startOfDay = (input?: string | Date) =>
  startOfKstDay(input ? new Date(input) : new Date());

/** `@db.Date` 컬럼과 비교/응답에 쓰는 YYYY-MM-DD 문자열 */
export const toDateString = (date: Date) => toKstDateString(date);
