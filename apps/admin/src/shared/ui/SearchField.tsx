"use client";

import React from "react";
import { Search } from "lucide-react";
import { Button, Input } from "@pawlog/ui";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
}

/**
 * 표 검색 입력 (shared ui).
 *
 * 4개 표 위젯이 같은 `<form>` + `<Input>` + 검색 버튼을 각자 복제하고 있었다.
 * 뉴모피즘에서 입력은 **눌린 면**으로 그린다 — 배경과 같은 톤에 테두리만 있으면
 * 어디를 클릭해야 하는지 형태로 드러나지 않는다.
 */
export const SearchField = ({
  value,
  onChange,
  onSubmit,
  placeholder,
}: SearchFieldProps) => (
  <form
    onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      onSubmit();
    }}
    className='flex w-full max-w-sm gap-2'
  >
    <div className='relative flex-1'>
      <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-meta' />
      <Input
        type='text'
        inputSize='sm'
        placeholder={placeholder}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        className='rounded-xl border-transparent pl-9 neu-inset placeholder:text-text-meta'
      />
    </div>
    <Button type='submit' size='sm' className='cursor-pointer px-5'>
      검색
    </Button>
  </form>
);
