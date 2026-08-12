"use client";

import { useState } from "react";
import { format, isValid, parse } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@pawlog/ui";

/** 폼이 주고받는 값의 형식. 서버의 `@db.Date` 와 같은 단위다. */
const VALUE_FORMAT = "yyyy-MM-dd";

/** `disabled` 매처는 react-day-picker 의 타입이다. web 에 직접 의존하지 않고 끌어온다. */
type CalendarProps = React.ComponentProps<typeof Calendar>;

export interface DatePickerProps {
  /** `"YYYY-MM-DD"` 또는 빈 문자열. */
  value?: string | null;
  /** 고르면 `"YYYY-MM-DD"`, 지우면 빈 문자열. */
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  /** 고를 수 없는 날 (예: `{ after: new Date() }`). */
  disabled?: CalendarProps["disabled"];
  /** 연도 드롭다운의 범위. 기본은 30년 전 ~ 5년 후. */
  startYear?: number;
  endYear?: number;
  /** 값을 비울 수 있는가. 선택 입력 칸이면 켠다. */
  clearable?: boolean;
  className?: string;
}

const DEFAULT_YEARS_BACK = 30;
const DEFAULT_YEARS_AHEAD = 5;

/**
 * 날짜 입력 (shared/ui) — shadcn `Popover` + `Calendar`.
 *
 * ## `<input type="date">` 를 걷어낸 이유
 *
 * 네이티브 날짜 입력은 **브라우저마다 다른 위젯**을 띄운다. 크롬은 회색 드롭다운, 사파리는
 * 휠, 안드로이드는 전체화면 다이얼로그다. 이 저장소가 토큰·라운딩·터치 타겟을 한 곳에서
 * 정해 둔 의미가 그 칸에서만 사라지고, 무엇보다 **높이·글자 크기를 우리가 못 정한다** —
 * 젖은 손으로 쓰는 화면에서 44px 미만이 섞이는 경로가 딱 여기였다(design-system.md §8).
 *
 * ## 연·월 드롭다운이 기본인 이유
 *
 * `captionLayout='dropdown'` 이 없으면 8살 강아지의 생년월일을 고르는 데 화살표를 96번
 * 눌러야 한다. 네이티브 입력은 최소한 타이핑이라도 됐으므로, 드롭다운 없이 바꾸면
 * 그 칸은 **이전보다 나빠진다.**
 *
 * ## 값은 문자열 그대로 다룬다
 *
 * 폼이 서버에 보내는 값이 `"YYYY-MM-DD"` 이고 서버 컬럼도 `@db.Date` 라, 중간에서 `Date`
 * 로 바꿔 들고 있으면 타임존이 붙어 KST 에서 하루가 밀린다. 문자열 ↔ Date 변환은 이
 * 컴포넌트 안에서만 일어나고 밖으로는 언제나 로컬 달력 기준 문자열이 나간다.
 */
export const DatePicker = ({
  value,
  onChange,
  id,
  placeholder = "날짜 선택",
  disabled,
  startYear,
  endYear,
  clearable = true,
  className,
}: DatePickerProps) => {
  const [open, setOpen] = useState(false);

  // 빈 값과 잘못된 값을 같게 다룬다 — 서버에서 온 이상한 문자열로 달력이 깨지지 않는다.
  const parsed = value ? parse(value, VALUE_FORMAT, new Date()) : null;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  const thisYear = new Date().getFullYear();
  const from = startYear ?? thisYear - DEFAULT_YEARS_BACK;
  const to = endYear ?? thisYear + DEFAULT_YEARS_AHEAD;

  const select = (next?: Date) => {
    onChange(next ? format(next, VALUE_FORMAT) : "");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type='button'
          variant='outline'
          className={`w-full justify-start px-3 font-normal ${
            selected ? "" : "text-muted-foreground"
          } ${className ?? ""}`}
        >
          <CalendarDays className='text-muted-foreground' />
          {selected ? format(selected, "yyyy년 M월 d일", { locale: ko }) : placeholder}
        </Button>
      </PopoverTrigger>

      {/* 기본 `w-72` 는 한 달 격자(7 × 44px)보다 좁아 잘린다 — 내용 폭에 맡긴다. */}
      <PopoverContent align='start' className='w-auto p-2'>
        <Calendar
          mode='single'
          selected={selected}
          onSelect={select}
          defaultMonth={selected}
          locale={ko}
          disabled={disabled}
          captionLayout='dropdown'
          startMonth={new Date(from, 0)}
          endMonth={new Date(to, 11)}
          /*
           * 기본 셀 28px 은 손가락으로 못 누른다. 그렇다고 터치 타겟 64px 을 그대로
           * 적용하면 한 달 격자가 448px 이라 팝오버가 화면을 덮는다 — 달력은 격자
           * 자체가 밀도를 강제하는 예외라 44px 로 타협한다.
           */
          className='[--cell-size:--spacing(11)] p-0'
        />

        {/* 지우기는 트리거가 아니라 여기 둔다 — 트리거 안에 버튼을 겹치면 누를 때마다
            "열기"와 "지우기"가 경쟁하고, 좁은 화면에서 실제로 잘못 눌린다. */}
        {clearable && selected && (
          <Button
            type='button'
            variant='ghost'
            className='w-full text-muted-foreground'
            onClick={() => select(undefined)}
          >
            지우기
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};
