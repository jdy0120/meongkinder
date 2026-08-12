import { Badge } from "@pawlog/ui";

/**
 * 테넌트 활성 상태 뱃지 (entity ui).
 * 정지 상태의 테넌트는 TenantMiddleware 가 모든 요청을 403 으로 막는다.
 */
export const TenantStatusBadge = ({ isActive }: { isActive: boolean }) => (
  <Badge
    variant='outline'
    className={`rounded-lg px-2.5 py-0.5 text-xs border ${
      isActive
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : "border-rose-500/30 bg-rose-500/10 text-rose-300"
    }`}
  >
    {isActive ? "운영중" : "정지"}
  </Badge>
);
