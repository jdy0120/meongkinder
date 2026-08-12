import { Badge } from "@pawlog/ui";
import { BADGE_LEVEL, type BadgeLevel } from "@pawlog/shared";

import { dailyReportStatusLabelMap } from "../lib/options";

/**
 * 일일 리포트 상태 (design-system.md §3.1).
 *
 * **작성 중(DRAFT)이 `caution`** 인 이유: 보호자에게 아직 안 나간 상태라 오늘 안에 발행하지
 * 않으면 그날 기록이 그대로 사라진다. 발행(PUBLISHED)은 할 일이 끝난 상태라 `normal`.
 *
 * job-052: 예전에는 slate/emerald 를 직접 칠했다. 색이 팔레트 밖이라 테마를 따라오지 않고,
 * 무엇보다 **분류마다 색을 주는 습관**의 입구였다 — 색은 긴급도만 인코딩한다.
 */
const STATUS_LEVEL: Record<string, BadgeLevel> = {
  DRAFT: BADGE_LEVEL.CAUTION,
  PUBLISHED: BADGE_LEVEL.NORMAL,
};

/** 일일 리포트 상태 뱃지 (entity ui) */
export const DailyReportStatusBadge = ({ status }: { status: string }) => (
  <Badge variant={STATUS_LEVEL[status] ?? BADGE_LEVEL.CAUTION}>
    {dailyReportStatusLabelMap[status] ?? status}
  </Badge>
);
