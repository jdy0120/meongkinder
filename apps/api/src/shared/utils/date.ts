/**
 * 서버 로컬 타임존 기준 오늘 00:00:00.
 *
 * `Attendance.date` 는 `@db.Date` 컬럼이라 정확히 자정으로 맞춰야 같은 날의 기록이
 * 하나로 모인다. UTC 자정을 쓰면 KST 아침 9시가 전날로 잡혀 **출석부가 하루 밀린다.**
 *
 * job-052: 원래 `care/services/attendance.service.ts` 안에 있었는데, 원생 목록도 "오늘의
 * 출석"을 함께 실어야 해서(§6.1 필터 칩) 두 모듈이 같은 정의를 쓰게 됐다. 각자 복사해
 * 두면 한쪽만 타임존을 고쳤을 때 **출석부와 원생 목록이 서로 다른 하루를 보게 된다.**
 */
export const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
