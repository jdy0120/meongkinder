import { Badge } from "@pawlog/ui";

import { categoryBadgeStyle, typeLabelMap } from "../lib/category";

/** 약관 구분(카테고리) 뱃지 (entity ui) */
export const TermsCategoryBadge = ({ type }: { type: string }) => (
  <Badge
    variant='outline'
    className={`rounded-lg px-2.5 py-1 text-xs border ${categoryBadgeStyle(type)}`}
  >
    {typeLabelMap[type] || type}
  </Badge>
);
