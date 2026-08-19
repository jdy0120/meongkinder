import type { ComponentType, ReactNode } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  /** 무슨 상황인지 한 줄 */
  title: string;
  /** 왜 비어 있는지 / 무엇을 하면 되는지 */
  description?: string;
  /**
   * 다음 행동. **비어 있는 화면에서 사용자가 할 수 있는 일이 있으면 반드시 넣는다**
   * (design-system.md §6) — 실제로 "등록된 아이가 없어요"만 띄우고 등록 버튼이 없어서
   * 보호자가 아무것도 못 하던 화면이 있었다.
   */
  action?: ReactNode;
}

/**
 * 빈 상태 (design-system.md §6).
 *
 * 신규 사용자가 **처음 보는 화면**이므로 가장 공들여야 하는 자리다. 여기서 막히면
 * 그 사람에게 이 서비스는 "아무것도 없는 앱"으로 끝난다.
 */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) => (
  <div className='flex flex-col items-center gap-4 rounded-card border border-dashed px-4 py-12 text-center'>
    <Icon className='size-8 text-muted-foreground' />
    <div className='space-y-1.5'>
      <p className='text-body font-semibold'>{title}</p>
      {description && (
        <p className='max-w-prose-ko break-keep text-label text-muted-foreground'>
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);
