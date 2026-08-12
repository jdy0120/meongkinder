import { Badge } from "@pawlog/ui";
import { BADGE_LEVEL, MEMBERSHIP_STATUS, type BadgeLevel } from "@pawlog/shared";

/**
 * 내 소속 상태 (design-system.md §3.1).
 *
 * 색은 **긴급도만** 인코딩한다 — 네 상태에 네 색을 주면 사용자는 색을 읽지 않고 글자만 읽는다.
 *   이용 중   확인 완료, 할 일 없음        → normal
 *   승인 대기 원장이 눌러 줘야 진행된다     → caution
 *   반려됨    다시 신청하거나 매장에 문의   → critical
 *   탈퇴      끝난 상태                    → normal (지난 일이라 급하지 않다)
 */
const STATUS: Record<string, { label: string; level: BadgeLevel }> = {
  [MEMBERSHIP_STATUS.ACTIVE]: { label: "이용 중", level: BADGE_LEVEL.NORMAL },
  [MEMBERSHIP_STATUS.PENDING]: {
    label: "승인 대기",
    level: BADGE_LEVEL.CAUTION,
  },
  [MEMBERSHIP_STATUS.REJECTED]: {
    label: "반려됨",
    level: BADGE_LEVEL.CRITICAL,
  },
  [MEMBERSHIP_STATUS.LEFT]: { label: "탈퇴", level: BADGE_LEVEL.NORMAL },
};

/** 내 소속 상태 뱃지 (entity ui) */
export const MembershipStatusBadge = ({ status }: { status: string }) => {
  const config = STATUS[status] ?? {
    label: status,
    level: BADGE_LEVEL.NORMAL,
  };

  return <Badge variant={config.level}>{config.label}</Badge>;
};
