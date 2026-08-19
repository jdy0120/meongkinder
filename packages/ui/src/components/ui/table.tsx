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
        className={cn("w-full caption-bottom text-body-sm", className)}
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
      className={cn(
        // 머리 행을 가라앉은 면에 올려 데이터와 층을 나눈다(Swiss: 색이 아니라 면).
        //
        // ⚠️ **`sticky top-0` 을 넣지 않았다.** 넣으면 `PageShell` 의 페이지 헤더가
        // 같은 `sticky top-0` 에 `z-20` 이라 표 머리가 그 **뒤로 숨는다**. 제대로
        // 하려면 높이가 고정된 스크롤 컨테이너 안에서 그 컨테이너 기준으로 붙여야
        // 하는데, 지금 레이아웃에는 그런 경계가 없다. 화면 구조를 바꾸기 전까지 보류.
        "bg-muted [&_tr]:border-b",
        className,
      )}
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
        // 밀도가 오르면 행이 촘촘해져 진한 구분선이 격자처럼 읽힌다 → `line-soft`.
        // hover 는 마우스 전용 신호이므로 색만 바꾸고 움직이지 않는다(변위 0).
        "border-b border-line-soft transition-colors duration-150 hover:bg-muted/60 data-[state=selected]:bg-accent",
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
        // 열 이름은 **읽는 글이 아니라 표지**다. 본문과 같은 크기·굵기면 첫 행과
        // 구별되지 않으므로, 작고 굵고 자간을 벌려 데이터와 다른 층으로 보낸다.
        "h-9 px-3 text-left align-middle text-label font-semibold tracking-wide whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
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
        // 높이를 토큰(`--spacing-row-dense` 44px)으로 고정한다. 셀 내용에 배지가
        // 있는 행만 커지면 표가 들쭉날쭉해져 눈이 행을 따라가지 못한다.
        "h-row-dense px-3 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
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
