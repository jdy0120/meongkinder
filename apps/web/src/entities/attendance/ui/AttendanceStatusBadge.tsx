import { Badge } from "@pawlog/ui";
import { BADGE_LEVEL, type BadgeLevel } from "@pawlog/shared";

import { attendanceStatusLabelMap } from "../lib/options";

/**
 * 출석 상태의 긴급도 (design-system.md §3.1).
 *
 * ⚠️ **미도착만 `critical`** 이다. 예정 시각이 지났는데 안 온 아이는 보호자 확인 전화로
 * 바로 이어져야 하는 유일한 출석 상태고, 나머지는 그냥 정보다.
 *
 * job-052: 예전에는 상태 6개에 색 6개(muted/blue/emerald/red/amber/muted)를 매핑했다.
 * 그러면 색이 **분류**를 뜻하게 되는데, 색은 종류만큼 늘어날 수 있어도 사람이 외울 수 있는
 * 색-의미 쌍은 서너 개뿐이다. 결국 사용자는 색을 읽지 않고 글자만 읽게 되고, 그 순간
 * 배지는 정보가 아니라 장식이 된다. **색은 긴급도만 인코딩한다.**
 */
export const resolveAttendanceLevel = (status: string): BadgeLevel => {
  switch (status) {
    case "ABSENT":
      return BADGE_LEVEL.CRITICAL;
    case "SCHEDULED":
      return BADGE_LEVEL.CAUTION;
    default:
      // CHECKED_IN · CHECKED_OUT · MAKEUP · CANCELED — 확인 완료, 신경 쓸 것 없음
      return BADGE_LEVEL.NORMAL;
  }
};

/** 출석 상태 뱃지 (entity ui) */
export const AttendanceStatusBadge = ({ status }: { status: string }) => (
  <Badge variant={resolveAttendanceLevel(status)}>
    {attendanceStatusLabelMap[status] ?? status}
  </Badge>
);

/** 원생 목록이 카드에 싣는 오늘의 출석 (`PetWithOwner.attendances[0]`). */
export interface TodayAttendance {
  id: string;
  status: string;
  checkInAt: Date | string | null;
  checkOutAt: Date | string | null;
}

/**
 * 오늘의 출석 배지. 기록 자체가 없으면 **아무것도 그리지 않는다** — 오늘 스케줄이 아닌
 * 아이는 안 오는 게 정상인데, "미등원" 같은 배지를 붙이면 문제처럼 보인다.
 */
export const TodayAttendanceBadge = ({
  attendance,
}: {
  attendance?: TodayAttendance;
}) => {
  if (!attendance) return null;
  return <AttendanceStatusBadge status={attendance.status} />;
};
