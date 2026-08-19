"use client";

import { useMemo, useState } from "react";
import { ko } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import {
  Button,
  Calendar,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Spinner,
} from "@pawlog/ui";
import {
  datesOfWeekdaysInMonth,
  SCHEDULE_TYPE,
  toDateKey,
  WEEKDAY_LABELS,
  type ScheduleType,
} from "@pawlog/shared";

import { SegmentedControl } from "@/shared/ui";

import { usePetSchedule, useUpdatePetSchedule } from "../model/usePetSchedule";

/** `"YYYY-MM-DD"` → `Date`. 달력에 넘길 때만 쓴다 (저장값은 언제나 문자열). */
const fromDateKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
};

/** `Date` → `"YYYY-MM"`. 화면이 보고 있는 달의 키. */
const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;

/**
 * 등원 스케줄 편집 (job-053).
 *
 * ## 왜 방식이 두 개인가
 *
 * 주 3회 정기권 아이는 매달 같은 요일에 온다 — 매달 달력을 다시 칠하게 하면 원생 20마리
 * × 12개월의 반복 노동이 된다. 반대로 파트타임 아이는 다음 주 일정이 그때그때 정해져
 * **요일 패턴 자체가 없다.** 하나로 강제하면 둘 중 한쪽은 반드시 앱 밖(수첩·단톡방)으로
 * 나가고, 앱 밖으로 나간 등원일은 알림장·이용권 차감과 영영 연결되지 않는다.
 *
 * ## 달력을 항상 보여주는 이유
 *
 * 매주 반복을 골라도 그 달의 날짜를 회색으로 그린다. "매주 화·목"이 이번 달 며칠인지
 * 원장이 머릿속으로 세지 않아도 되고, 방식을 바꿀 때 **무엇이 달라지는지 눈으로 확인**한
 * 뒤 저장할 수 있다. 이때 달력은 읽기 전용이다 — 반복 모드에서 개별 날짜를 만지게 하면
 * 그 편집이 어디에 저장되는지 설명할 수 없다.
 */
export const PetScheduleDialog = ({
  petId,
  petName,
}: {
  petId: string;
  petName: string;
}) => {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const monthKey = toMonthKey(cursor);

  const { data, isLoading } = usePetSchedule(petId, monthKey, open);
  const save = useUpdatePetSchedule(petId, () => setOpen(false));

  /**
   * 사용자가 만진 값만 담는다. 손대지 않은 칸은 서버 값이 그대로 보인다.
   *
   * `useEffect` 로 서버 응답을 state 에 복사하지 않는 이유: 그 방식은 응답이 도착할
   * 때마다 렌더를 한 번 더 유발하고(react-hooks/set-state-in-effect), 무엇보다 **달을
   * 넘길 때 사용자가 방금 고른 값을 서버 값이 덮어쓴다.** 편집분을 따로 들고 있으면
   * 그 충돌 자체가 생기지 않는다.
   */
  const [edits, setEdits] = useState<{
    scheduleType?: ScheduleType;
    weekdays?: number[];
    dates?: string[];
  }>({});

  const scheduleType =
    edits.scheduleType ??
    (data?.scheduleType as ScheduleType | undefined) ??
    SCHEDULE_TYPE.WEEKLY;
  const weekdays = edits.weekdays ?? data?.scheduleDays ?? [];
  const dates = edits.dates ?? data?.dates ?? [];

  const setScheduleType = (value: ScheduleType) =>
    setEdits((prev) => ({ ...prev, scheduleType: value }));

  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;

  // 반복 모드의 달력은 요일 패턴에서 계산한다 — 서버가 내려준 값을 그대로 쓰면 요일을
  // 토글하는 즉시 화면이 따라오지 않아 "저장해 봐야 아는" 상태가 된다.
  const previewDates = useMemo(
    () =>
      scheduleType === SCHEDULE_TYPE.WEEKLY
        ? datesOfWeekdaysInMonth(year, month, weekdays)
        : dates,
    [scheduleType, year, month, weekdays, dates],
  );

  const editable = scheduleType === SCHEDULE_TYPE.MONTHLY;

  /**
   * 지난 날짜는 고를 수 없다 — **오늘부터**다.
   *
   * 서버도 같은 규칙으로 막지만(400), 화면에서 누를 수 있게 두면 저장을 눌러야 비로소
   * 거절당한다. 지난 날을 지정한다는 것 자체가 뜻이 없다: 그 날의 출석부는 이미 지나갔고,
   * 예정일 행을 넣어도 어느 화면에도 나타나지 않는다.
   */
  const todayKey = toDateKey(new Date());
  const isPast = (key: string) => key < todayKey; // "YYYY-MM-DD" 는 사전순 = 시간순

  /** 저장 시 지난 날짜는 실어 보내지 않는다. 서버의 교체 범위도 오늘부터라 서로 맞는다. */
  const futureDates = dates.filter((key) => !isPast(key));

  const toggleWeekday = (day: number) =>
    setEdits((prev) => ({
      ...prev,
      weekdays: weekdays.includes(day)
        ? weekdays.filter((value) => value !== day)
        : [...weekdays, day].sort((a, b) => a - b),
    }));

  /**
   * 달력이 돌려준 선택 전체로 교체한다 (react-day-picker 의 `mode='multiple'`).
   *
   * 예전에는 누른 날 하나를 토글했는데, 달력이 이미 "누른 뒤의 목록"을 주므로 그걸 그대로
   * 쓴다. 지난 날짜는 달력이 `disabled` 로 막아 목록에 들어오지도 나가지도 않는다 —
   * 이미 잡혀 있던 지난 예정일이 조용히 지워지지 않는다는 뜻이다.
   */
  const replaceDates = (next?: Date[]) =>
    setEdits((prev) => ({
      ...prev,
      dates: (next ?? []).map(toDateKey).sort(),
    }));

  /**
   * 그 달을 요일 패턴으로 한 번에 칠한다. 날짜 지정이어도 대개 규칙이 있다.
   *
   * 이번 달이면 **오늘 이후만** 칠하고, 이미 지나간 날에 잡혀 있던 예정일은 그대로 둔다.
   * (지난 예정일을 지우면 그 달 앞부분 기록이 통째로 사라진다 — 서버의 교체 범위도 같다.)
   */
  const fillFromWeekdays = () =>
    setEdits((prev) => ({
      ...prev,
      dates: [
        ...dates.filter(isPast),
        ...datesOfWeekdaysInMonth(year, month, weekdays).filter(
          (key) => !isPast(key),
        ),
      ].sort(),
    }));

  const jumpToMonth = (next: Date) => {
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    // 날짜 편집분은 그 달의 것이므로 달을 넘길 때 버린다 — 안 버리면 8월에 고른 날짜가
    // 9월 달력에 그대로 남아 저장 시 "이 달 이외의 날짜" 오류가 난다.
    setEdits((prev) => ({ ...prev, dates: undefined }));
  };

  const submit = () =>
    save.mutate(
      scheduleType === SCHEDULE_TYPE.WEEKLY
        ? { scheduleType, scheduleDays: weekdays }
        : { scheduleType, month: monthKey, dates: futureDates },
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' className='flex-1'>
          <CalendarDays />
          등원 요일
        </Button>
      </DialogTrigger>

      <DialogContent className='max-h-[90vh] overflow-x-hidden overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{petName} 등원 스케줄</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className='flex justify-center py-10'>
            <Spinner className='size-8 text-primary' />
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            <SegmentedControl
              label='등원 스케줄 방식'
              value={scheduleType}
              onChange={setScheduleType}
              options={[
                { value: SCHEDULE_TYPE.WEEKLY, label: "매주 반복" },
                { value: SCHEDULE_TYPE.MONTHLY, label: "날짜 지정" },
              ]}
            />

            <p className='break-keep text-label text-muted-foreground'>
              {scheduleType === SCHEDULE_TYPE.WEEKLY
                ? "고른 요일에 매주 등원합니다. 달이 바뀌어도 다시 짜지 않아도 됩니다."
                : "고른 날짜에만 등원합니다. 다음 달은 비어 있으니 달을 넘겨 다시 짜야 합니다."}
            </p>

            {/* 요일 토글은 두 방식에서 역할이 다르다: 반복은 이게 저장값이고,
                날짜 지정은 달력을 한 번에 칠하는 재료다. */}
            <section className='flex flex-col gap-3'>
              <h3 className='text-label font-semibold text-muted-foreground'>
                {scheduleType === SCHEDULE_TYPE.WEEKLY
                  ? "등원 요일"
                  : "요일로 채우기"}
              </h3>

              <div className='flex gap-1.5'>
                {WEEKDAY_LABELS.map((label, day) => {
                  const on = weekdays.includes(day);
                  return (
                    <button
                      key={label}
                      type='button'
                      onClick={() => toggleWeekday(day)}
                      aria-pressed={on}
                      aria-label={`${label}요일`}
                      className={`flex h-touch flex-1 items-center justify-center rounded-xl border text-body font-semibold transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {editable && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={fillFromWeekdays}
                  disabled={weekdays.length === 0}
                >
                  {month}월을 이 요일로 채우기
                </Button>
              )}
            </section>

            <section className='flex flex-col gap-3'>
              {/*
               * 반복 모드의 달력은 **읽기 전용 미리보기**다. `disabled` 로 잠그지 않고
               * 포인터만 끄는 이유: shadcn 의 disabled 는 칸을 흐리게 그리는데, 이 미리보기는
               * 흐려지면 안 된다 — "이번 달 며칠에 오는가"를 읽으라고 띄운 정보다.
               * (흐림은 지난 날짜 전용 신호로 남겨 둔다.)
               */}
              <div
                className={editable ? undefined : "pointer-events-none"}
                aria-readonly={!editable}
              >
                <Calendar
                  mode='multiple'
                  selected={previewDates.map(fromDateKey)}
                  onSelect={editable ? replaceDates : undefined}
                  month={cursor}
                  onMonthChange={jumpToMonth}
                  locale={ko}
                  /* 지난 달로는 가지 않는다 — 거기서는 고를 수 있는 날이 하나도 없어
                     빈 달력만 보여주게 되고, "왜 아무것도 안 눌리지"로 읽힌다. */
                  startMonth={new Date()}
                  /* 지난 날짜는 고를 수 없다. 서버도 같은 규칙으로 막지만(400), 화면에서
                     누를 수 있게 두면 저장을 눌러야 비로소 거절당한다. */
                  disabled={{ before: new Date() }}
                  /* 옆 달 날짜는 숨긴다 — 저장 단위가 **한 달**이라, 눌러도 이 달의
                     예정일이 되지 않는 칸을 보여주면 그대로 오해가 된다. */
                  showOutsideDays={false}
                  /* 격자가 다이얼로그 폭을 채우게 한다. 셀 44px 은 job-052 의 타협값
                     (64px 을 그대로 쓰면 한 달이 448px 이라 다이얼로그를 넘긴다). */
                  className='w-full [--cell-size:--spacing(11)] p-0'
                />
              </div>

              <p className='text-label text-muted-foreground'>
                {month}월 등원 {previewDates.length}일
                {!editable && " (요일 패턴에서 계산한 미리보기입니다)"}
              </p>
            </section>

            <Button onClick={submit} disabled={save.isPending} size='lg'>
              {save.isPending ? <Spinner className='size-5' /> : null}
              저장
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
