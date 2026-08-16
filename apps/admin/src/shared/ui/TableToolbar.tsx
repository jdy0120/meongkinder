import React from "react";

interface TableToolbarProps {
  /** 왼쪽 — 상태 탭·필터 칩 등. */
  children?: React.ReactNode;
  /** 오른쪽 — 검색·등록 버튼 등. */
  actions?: React.ReactNode;
}

/**
 * 표 카드 상단 도구줄 (shared ui).
 * 좁은 화면에서는 세로로 쌓이고, 넓어지면 좌우로 갈린다.
 */
export const TableToolbar = ({ children, actions }: TableToolbarProps) => (
  <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
    <div className='flex flex-wrap items-center gap-2'>{children}</div>
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
      {actions}
    </div>
  </div>
);
