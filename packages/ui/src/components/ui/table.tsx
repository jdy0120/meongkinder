"use client";

import * as React from "react";

import { cn } from "../../lib/utils";

function Table({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <div
      data-slot='table-container'
      className='relative w-full overflow-x-auto'
    >
      <table
        data-slot='table'
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot='table-header'
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot='table-body'
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({
  className,
  ...props
}: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot='table-row'
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 표 머리 셀.
 *
 * `scope='col'` 을 **기본값으로** 준다 — 스크린리더는 이 값이 있어야 각 데이터 셀을
 * 읽을 때 어느 열인지 함께 말한다. 없으면 원생 목록에서 "010-1234-5678" 만 읽히고
 * 그게 보호자 번호인지 비상연락처인지 알 수 없다(열이 8개인 표가 여럿이다).
 * 브라우저의 헤더 추론은 단순한 표에서만 맞고, 이 저장소의 표들은 `colSpan` 과
 * 액션 열이 섞여 있어 추론이 어긋난다.
 *
 * 행 머리로 쓸 때는 호출부가 `scope='row'` 로 덮어쓴다 — 뒤의 `{...props}` 가 이긴다.
 */
function TableHead({
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      data-slot='table-head'
      scope='col'
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  ...props
}: React.ComponentProps<"td">) {
  return (
    <td
      data-slot='table-cell'
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot='table-caption'
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
