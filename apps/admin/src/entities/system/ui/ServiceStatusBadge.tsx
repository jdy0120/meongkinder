import { Badge } from "@pawlog/ui";

import type { ServiceHealth } from "../model/types";

/** 서비스 상태 → 표시 라벨/스타일 매핑 */
const STATE_MAP: Record<ServiceHealth, { label: string; className: string }> = {
  up: {
    label: "정상",
    className:
      "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20",
  },
  down: {
    label: "중단",
    className:
      "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20",
  },
  unknown: {
    label: "점검 필요",
    className:
      "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20",
  },
};

/** 개별 서비스 헬스 상태 뱃지 (entity ui) */
export const ServiceStatusBadge = ({ state }: { state: ServiceHealth }) => {
  const config = STATE_MAP[state];
  return <Badge className={config.className}>{config.label}</Badge>;
};
