"use client";

import { NativeSelect, NativeSelectOption } from "@pawlog/ui";
import { minutesToTime, timeToMinutes } from "@pawlog/shared";

/** 분 단위 선택지. 5분 간격이면 09:30·13:45 같은 실제 운영시간을 전부 표현할 수 있다. */
const MINUTE_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) =>
  `${i * MINUTE_STEP}`.padStart(2, "0"),
);

type Props = {
  value: string;
  onChange: (value: string) => void;
  /**
   * 마감 시각인가.
   *
   * 마감에만 `24:00`(자정 마감)을 열어 준다 — 개점에 24:00 은 뜻이 없고, `00:00` 으로
   * 자정 마감을 표현하면 개점과 같아져 "0분 영업"과 구분되지 않는다.
   */
  allowMidnight?: boolean;
  "aria-label"?: string;
};

/**
 * 시·분 드롭다운 한 쌍 (job-060).
 *
 * ⚠️ `<input type="time">` 을 쓰지 않는다. 네이티브 시각 입력은 **23:59 를 넘길 수 없어
 * 자정 마감(`24:00`)을 아예 입력할 수 없다.** 24시간 운영하는 애견호텔이 실제로 있고,
 * 그 매장은 이 폼에서 자기 운영시간을 표현할 방법이 사라진다.
 *
 * 드롭다운은 덤으로 모바일에서 더 낫다 — 젖은 손으로 시각 스피너를 굴리는 것보다
 * 목록에서 하나를 고르는 편이 빠르고 오조작이 적다(design-system.md §터치 타겟).
 */
export const TimeSelect = ({
  value,
  onChange,
  allowMidnight = false,
  "aria-label": ariaLabel,
}: Props) => {
  const minutes = timeToMinutes(value) ?? 0;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  const hours = Array.from({ length: allowMidnight ? 25 : 24 }, (_, i) =>
    `${i}`.padStart(2, "0"),
  );

  const emit = (nextHour: number, nextMinute: number) => {
    // 24시는 24:00 뿐이다. 분을 남겨 두면 24:30 같은 없는 시각이 만들어진다.
    const safeMinute = nextHour === 24 ? 0 : nextMinute;
    onChange(minutesToTime(nextHour * 60 + safeMinute));
  };

  return (
    // NativeSelect 는 폼에서 폭이 갈리지 않도록 `w-full` 이라, 시각 두 칸을 나란히
    // 둘 때는 호출부가 폭을 잡아 줘야 한다.
    <div className='flex items-center gap-2'>
      <NativeSelect
        className='w-24'
        aria-label={ariaLabel ? `${ariaLabel} 시` : "시"}
        value={`${hour}`.padStart(2, "0")}
        onChange={(event) => emit(Number(event.target.value), minute)}
      >
        {hours.map((item) => (
          <NativeSelectOption key={item} value={item}>
            {item}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <span className='text-muted-foreground'>:</span>
      <NativeSelect
        className='w-24'
        aria-label={ariaLabel ? `${ariaLabel} 분` : "분"}
        value={`${minute}`.padStart(2, "0")}
        disabled={hour === 24}
        onChange={(event) => emit(hour, Number(event.target.value))}
      >
        {MINUTES.map((item) => (
          <NativeSelectOption key={item} value={item}>
            {item}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
};
