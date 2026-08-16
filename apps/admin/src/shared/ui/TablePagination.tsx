"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@pawlog/ui";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  /** "총 12명" 처럼 숫자 뒤에 붙는 단위. */
  unit: string;
  onChange: (page: number) => void;
}

/**
 * 표 하단 페이지네이션 (shared ui).
 *
 * 세 표가 같은 마크업을 복제하고 있었다. 구분선(`border-t`) 대신 여백으로 나눈다 —
 * 뉴모피즘 화면에서 선은 면과 싸운다.
 */
export const TablePagination = ({
  page,
  totalPages,
  total,
  unit,
  onChange,
}: TablePaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <div className='mt-5 flex items-center justify-between'>
      <span className='text-body-sm text-text-muted'>
        총 {total.toLocaleString()}
        {unit} 중{" "}
        <span className='font-semibold text-foreground'>{page}</span> /{" "}
        {totalPages} 페이지
      </span>
      <div className='flex gap-2'>
        <Button
          variant='outline'
          size='sm'
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className='cursor-pointer gap-1 border-transparent bg-transparent px-3 text-text-muted neu-press'
        >
          <ChevronLeft className='size-4' />
          이전
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className='cursor-pointer gap-1 border-transparent bg-transparent px-3 text-text-muted neu-press'
        >
          다음
          <ChevronRight className='size-4' />
        </Button>
      </div>
    </div>
  );
};
