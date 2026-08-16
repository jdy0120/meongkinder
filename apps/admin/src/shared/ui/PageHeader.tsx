import React from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  /** 제목 왼쪽 아이콘 (선택). */
  icon?: React.ReactNode;
  /** 오른쪽 정렬 액션 — 주로 등록 다이얼로그 트리거. */
  action?: React.ReactNode;
}

/**
 * 콘솔 페이지 헤더 (shared ui).
 *
 * 6개 view 가 같은 마크업(제목 + 설명 + 선택적 액션)을 각자 들고 있었고, 그래서 색과
 * 간격이 화면마다 조금씩 달랐다. 여기 한 곳으로 모아 두면 테마가 바뀔 때 따라오지 못하는
 * 화면이 생기지 않는다.
 */
export const PageHeader = ({
  title,
  description,
  icon,
  action,
}: PageHeaderProps) => (
  <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
    <div className='flex flex-col gap-1.5'>
      <h1 className='flex items-center gap-2 text-title text-foreground'>
        {icon}
        {title}
      </h1>
      <p className='max-w-3xl text-body-sm text-text-muted'>{description}</p>
    </div>
    {action}
  </div>
);
