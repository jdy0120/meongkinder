import { Badge } from "@pawlog/ui";

import { roleBadgeStyle, roleLabel } from "../lib/roleLabel";

/** 사용자 역할 뱃지 (entity ui) */
export const RoleBadge = ({ role }: { role: string }) => (
  <Badge
    variant='outline'
    className={`rounded-lg px-2.5 py-0.5 text-xs border ${roleBadgeStyle(role)}`}
  >
    {roleLabel(role)}
  </Badge>
);
