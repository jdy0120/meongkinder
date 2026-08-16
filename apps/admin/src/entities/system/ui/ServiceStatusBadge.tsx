import { Badge } from "@pawlog/ui";

import type { ServiceHealth } from "../model/types";

/**
 * 서비스 상태 → 표시 라벨/긴급도 매핑.
 *
 * 색은 분류가 아니라 **긴급도**만 인코딩한다(@pawlog/ui Badge 의 3단계).
 * 예전에는 emerald/rose/amber 를 직접 클래스로 칠했는데, 그러면 테마가 바뀔 때
 * 이 파일만 따라오지 못한다.
 */
const STATE_MAP: Record<
  ServiceHealth,
  { label: string; variant: "normal" | "caution" | "critical" }
> = {
  up: { label: "정상", variant: "normal" },
  down: { label: "중단", variant: "critical" },
  unknown: { label: "점검 필요", variant: "caution" },
};

/** 개별 서비스 헬스 상태 뱃지 (entity ui) */
export const ServiceStatusBadge = ({ state }: { state: ServiceHealth }) => {
  const config = STATE_MAP[state];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};
