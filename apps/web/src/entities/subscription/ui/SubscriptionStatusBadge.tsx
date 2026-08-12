import { Badge } from "@pawlog/ui";
import { BADGE_LEVEL, type BadgeLevel } from "@pawlog/shared";

/**
 * 구독 상태 (design-system.md §3.1).
 *
 * 긴급도로만 나눈다 — **결제 실패 보류가 유일하게 `critical`** 이다. 돈이 안 걷힌 상태라
 * 그대로 두면 서비스가 끊기고, 원장이 오늘 조치해야 한다. 만료·해지예정은 이미 정해진
 * 미래라 알고만 있으면 된다.
 */
const STATUS: Record<string, { label: string; level: BadgeLevel }> = {
  ACTIVE: { label: "활성", level: BADGE_LEVEL.NORMAL },
  CANCELED: { label: "해지예정", level: BADGE_LEVEL.CAUTION },
  EXPIRED: { label: "만료", level: BADGE_LEVEL.CAUTION },
  FAIL_PAUSED: { label: "결제실패 보류", level: BADGE_LEVEL.CRITICAL },
};

/** 구독 상태 뱃지 (entity ui) */
export const SubscriptionStatusBadge = ({ status }: { status: string }) => {
  const config = STATUS[status];
  if (!config) {
    // 모르는 코드는 숨기지 않고 그대로 보여준다 — 숨기면 원인을 못 찾는다.
    return <Badge variant='outline'>{status}</Badge>;
  }
  return <Badge variant={config.level}>{config.label}</Badge>;
};
