import type { ReportContentLike } from "../lib/options";

import { groupContentsForConditionSummary } from "../lib/options";

/** 리포트 상세/카드에서 식사·배변·낮잠·활동·건강 항목을 컨디션 요약 형태로 보여주는 presentational 컴포넌트 */
export const ConditionSummary = ({ contents }: { contents: ReportContentLike[] }) => {
  const groups = groupContentsForConditionSummary(contents);

  if (groups.length === 0) {
    return <p className='text-sm text-muted-foreground'>기록된 컨디션 정보가 없어요.</p>;
  }

  return (
    <dl className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
      {groups.map((group) => (
        <div key={group.type} className='rounded-xl bg-muted/60 p-3'>
          <dt className='text-xs font-medium text-muted-foreground'>{group.label}</dt>
          <dd className='mt-1 text-sm font-medium'>
            {group.contents
              .map((content) => content.title || content.content)
              .filter(Boolean)
              .join(", ") || "-"}
          </dd>
        </div>
      ))}
    </dl>
  );
};
