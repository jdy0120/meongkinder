import { Badge } from "@template/ui";

/** 구독 상태 코드 → 표시 라벨/스타일 매핑 */
const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "활성",
    className:
      "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20",
  },
  CANCELED: {
    label: "해지예정",
    className:
      "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20",
  },
  EXPIRED: {
    label: "만료",
    className:
      "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20",
  },
  FAIL_PAUSED: {
    label: "결제실패 보류",
    className:
      "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20",
  },
};

/** 구독 상태 뱃지 (entity ui) */
export const SubscriptionStatusBadge = ({ status }: { status: string }) => {
  const config = STATUS_MAP[status];
  if (!config) {
    return (
      <Badge className='bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border-slate-500/20'>
        {status}
      </Badge>
    );
  }
  return <Badge className={config.className}>{config.label}</Badge>;
};
