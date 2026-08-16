import { Badge } from "@pawlog/ui";

/**
 * 테넌트 활성 상태 뱃지 (entity ui).
 * 정지 상태의 테넌트는 TenantMiddleware 가 모든 요청을 403 으로 막는다 — 그래서
 * 정지는 `critical`(지금 조치가 필요한 상태)이다.
 */
export const TenantStatusBadge = ({ isActive }: { isActive: boolean }) => (
  <Badge variant={isActive ? "normal" : "critical"}>
    {isActive ? "운영중" : "정지"}
  </Badge>
);
