/**
 * 피드의 날짜 축 유틸.
 *
 * FeedPost.date / Attendance.date 는 모두 `@db.Date` 라 시각 성분이 없어야 한다.
 * 서버 로컬 타임존 기준 자정으로 정규화해 "오늘의 커버리지"와 "하루 마감"이 같은 하루를 본다.
 */

/** 서버 로컬 타임존 기준 해당 일자의 00:00:00 (미지정 시 오늘) */
export const startOfDay = (input?: string | Date) => {
  const base = input ? new Date(input) : new Date();
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
};

/** `@db.Date` 컬럼과 비교/응답에 쓰는 YYYY-MM-DD 문자열 */
export const toDateString = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
