/**
 * 날짜 축의 단일 출처 — **한국 달력 날짜를 UTC 자정 `Date` 로 표현한다.**
 *
 * ## 왜 이 규칙인가
 *
 * `Attendance.date` · `PetSchedule.date` · `TenantClosure.date` · `FeedPost.date` 는
 * `@db.Date` 컬럼이라 시각 성분이 없다. 그래서 두 가지를 **동시에** 만족해야 한다:
 *
 *   ① 어느 날인가  — 한국 사용자의 달력 기준이어야 한다. 자정이 지나면 오늘이어야 한다.
 *   ② 어떻게 저장되나 — Prisma 가 UTC ISO 로 직렬화하므로 **UTC 자정**이어야 그 날로 저장된다.
 *
 * 이전 구현은 `new Date(y, m, d)`(서버 로컬 자정)이라 둘 중 하나만 맞았다:
 *
 *   - 컨테이너 TZ=UTC (실제 배포):   저장은 맞지만 **"오늘"이 KST 09:00 에 넘어갔다.**
 *     새벽 1시~오전 9시 사이에는 서버가 어제를 오늘로 알아서, 그 시간대에 출석부를 열면
 *     어제 날짜의 행이 만들어지고 등원 체크가 어제로 기록됐다.
 *   - 프로세스 TZ=Asia/Seoul (노트북): "오늘"은 맞지만 로컬 자정이 UTC 전날 15:00 이라
 *     DATE 컬럼에 **하루 전날**이 저장됐다.
 *
 * 아래 방식은 프로세스 타임존과 **무관하게** 둘 다 만족한다. 그래서 이 함수들이
 * 돌려준 값은 서버 TZ 설정이 무엇이든 같다.
 *
 * ⚠️ 여기서 나온 `Date` 의 날짜를 읽을 때는 `getUTCFullYear()` 계열을 쓴다.
 *    로컬 게터(`getFullYear()`)는 프로세스가 UTC 가 아니면 하루 어긋난다.
 *    단 `getDay()`(요일)는 UTC 자정 값에 대해 UTC 기준이면 되므로 `getUTCDay()` 를 쓴다.
 *
 * job-052: 원래 `care/services/attendance.service.ts` 안에 있었는데, 원생 목록도 "오늘의
 * 출석"을 함께 실어야 해서 두 모듈이 같은 정의를 쓰게 됐다. 각자 복사해 두면 한쪽만
 * 타임존을 고쳤을 때 **출석부와 원생 목록이 서로 다른 하루를 보게 된다.**
 */

/** KST 는 UTC+9. 한국은 서머타임이 없어 고정 오프셋으로 충분하다. */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 어떤 시점이 속한 **한국 달력 날짜**의 UTC 자정.
 *
 * 예) 실제 시각이 UTC 2026-08-17 23:30 (= KST 2026-08-18 08:30) 이면
 *     `2026-08-18T00:00:00.000Z` 를 돌려준다.
 */
export const startOfKstDay = (at: Date = new Date()): Date => {
  const kst = new Date(at.getTime() + KST_OFFSET_MS);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()),
  );
};

/** 한국 달력 기준 오늘 00:00. 자정이 지나는 즉시 다음 날로 넘어간다. */
export const startOfToday = (): Date => startOfKstDay();

/**
 * 한국 달력 기준 내일 00:00.
 *
 * UTC 자정끼리의 +24h 는 언제나 정확히 다음 UTC 자정이다(UTC 에는 서머타임이 없다).
 */
export const startOfTomorrow = (): Date =>
  new Date(startOfToday().getTime() + DAY_MS);

/**
 * 위 함수들이 만든 UTC 자정 `Date` → `"YYYY-MM-DD"`.
 *
 * ⚠️ 로컬 게터가 아니라 UTC 게터를 쓴다 — 그래야 프로세스 TZ 와 무관하게 같은 문자열이 된다.
 */
export const toKstDateString = (date: Date): string => {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
};
