"use client";

import { useMemo, useState } from "react";
import { ko } from "date-fns/locale";
import { CalendarOff, Clock, TriangleAlert } from "lucide-react";
import {
  Button,
  Calendar,
  CalendarDayButton,
  Card,
  CardContent,
  Spinner,
} from "@pawlog/ui";
import {
  QUOTA_BLOCKS,
  RESERVATION_BLOCK,
  RESERVATION_BLOCK_MESSAGE,
  fromDateKey,
  summarizeBusinessHours,
  toDateKey,
  type ReservationBlock,
  type ReservationDay,
} from "@pawlog/shared";

import { EmptyState, SectionHeading, StatTile } from "@/shared/ui";
import {
  useCancelReservation,
  useCreateReservation,
  useReservationCalendar,
} from "../model/useReservations";

/** `Date` → `"YYYY-MM"`. 화면이 보고 있는 달의 키. */
const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;

/**
 * 등원 예약 달력 (job-060) — 보호자가 매장 운영일 중에서 아이가 갈 날을 고른다.
 *
 * ## 판정은 서버가 한다
 *
 * 어느 날을 고를 수 있는지(`blockedBy`)는 서버가 계산해서 내려준다. 화면이 운영시간과
 * 잔액으로 다시 판단하면 규칙이 두 벌이 되고, 그러면 **달력에서는 눌리는데 저장하면
 * 400 이 나는** 날이 반드시 생긴다 — 잔액은 원장이 언제든 바꾸는 값이라 더 그렇다.
 *
 * ## 고르고 나서 한 번에 보낸다
 *
 * 누를 때마다 요청을 보내면 5일을 잡는 데 5번의 왕복이 생기고, 그 사이에 잔액이 떨어지면
 * 절반만 잡힌 채로 끝난다. 서버도 **하나라도 막히면 전부 거절**하므로 화면의 단위와
 * 서버의 단위가 같다.
 */
export const ReservationCalendar = ({ petId }: { petId: string }) => {
  const [cursor, setCursor] = useState(() => new Date());
  const monthKey = toMonthKey(cursor);

  const { data, isLoading } = useReservationCalendar(petId, monthKey);
  const create = useCreateReservation(petId);
  const cancel = useCancelReservation(petId);

  /** 아직 보내지 않은 선택. 달을 넘기면 버린다(그 달의 선택이므로). */
  const [picked, setPicked] = useState<string[]>([]);

  const byDate = useMemo(() => {
    const map = new Map<string, ReservationDay>();
    for (const day of data?.days ?? []) map.set(day.date, day);
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className='flex justify-center py-10'>
        <Spinner className='size-8 text-primary' />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title='예약 정보를 불러오지 못했습니다.'
        description='잠시 후 다시 시도해주세요.'
      />
    );
  }

  // ── 예약 자체가 성립하지 않는 상태는 달력 대신 사유를 보여준다 ──────────
  //
  // 잠긴 달력을 띄우고 아무 설명도 하지 않으면 보호자는 앱이 고장 났다고 판단한다.
  // 두 경우 모두 보호자가 앱 안에서 할 수 있는 일이 없으므로, 무엇을 해야 하는지를
  // 문장으로 말하는 편이 낫다.
  if (!data.tenant) {
    return (
      <EmptyState
        icon={CalendarOff}
        title='아직 유치원에 등록되지 않았어요'
        description={RESERVATION_BLOCK_MESSAGE[RESERVATION_BLOCK.NOT_ENROLLED]}
      />
    );
  }

  if (!data.businessHours) {
    return (
      <EmptyState
        icon={Clock}
        title={`${data.tenant.name}이 운영시간을 등록하지 않았어요`}
        description={
          RESERVATION_BLOCK_MESSAGE[RESERVATION_BLOCK.NO_BUSINESS_HOURS]
        }
      />
    );
  }

  const jumpToMonth = (next: Date) => {
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    // 선택은 그 달의 것이다. 안 버리면 8월에 고른 날짜를 9월 달력에서 보내게 된다.
    setPicked([]);
  };

  /**
   * 달력이 돌려준 선택에서 **아직 보내지 않은 것만** 남긴다
   * (react-day-picker `mode='multiple'`).
   *
   * ⚠️ `selected` 에는 이미 예약된 날(`reservedDates`)도 함께 넣는다 — 달력에 표시되어야
   * 하기 때문이다. 그런데 `onSelect` 는 **선택 전체**를 돌려주므로, 받은 값을 그대로
   * `picked` 에 넣으면 예약된 날이 picked 로 섞여 들어간다. 그러면 다음 렌더에서
   * `selected = reserved + picked` 가 그 날짜를 **두 번** 담고, "선택한 날" 목록에도
   * 중복으로 뜬다. 게다가 예약된 날은 `disabled` 라 다시 눌러 뺄 수도 없어 **영영
   * 지워지지 않는다.**
   *
   * 그래서 예약된 날을 걷어낸다. 취소는 이 경로로 일어나지 않는다 — 달력 토글에 묶으면
   * 한 번의 오터치로 예약이 사라지고 그 사실이 화면 어디에도 남지 않는다. 아래 목록에서
   * 명시적으로 누르게 한다.
   */
  const replacePicked = (next?: Date[]) => {
    const reserved = new Set(
      data.days.filter((day) => day.reserved).map((day) => day.date),
    );
    setPicked(
      [
        ...new Set(
          (next ?? []).map(toDateKey).filter((date) => !reserved.has(date)),
        ),
      ].sort(),
    );
  };

  const remainingAfterPick = data.remaining - picked.length;

  /**
   * 그 날을 못 고르는가.
   *
   * ⚠️ `blockedBy` 를 그대로 쓰지 않고 `NO_BALANCE` 만 다시 계산한다. 서버의 판정은
   * **아직 보내지 않은 이번 선택**을 모르기 때문이다 — 3회 남은 사람이 3일을 고른
   * 뒤에도 네 번째 날이 계속 눌리면, 저장 버튼을 눌러야 비로소 거절당한다.
   */
  const isDisabled = (date: Date) => {
    const day = byDate.get(toDateKey(date));
    if (!day) return true;
    if (QUOTA_BLOCKS.includes(day.blockedBy as ReservationBlock)) {
      return remainingAfterPick <= 0 && !picked.includes(day.date);
    }
    return day.blockedBy !== null;
  };

  const reservedDates = data.days
    .filter((day) => day.reserved)
    .map((day) => day.date);
  const cancelableDays = data.days.filter((day) => day.cancelable);
  const closedDays = data.days.filter(
    (day) => day.blockedBy === RESERVATION_BLOCK.TEMPORARILY_CLOSED,
  );
  const summary = summarizeBusinessHours(data.businessHours);

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-2 gap-3'>
        <StatTile label='남은 이용권' value={data.balance} unit='회' />
        <StatTile
          label='더 예약 가능'
          value={Math.max(0, remainingAfterPick)}
          unit='회'
          // 0이면 이 화면에서 더 할 수 있는 일이 없다 — 색으로 먼저 알린다.
          tone={remainingAfterPick <= 0 ? "caution" : "default"}
        />
      </div>

      <Card>
        <CardContent className='flex flex-col gap-3 pt-6'>
          <SectionHeading>{data.tenant.name} 운영시간</SectionHeading>
          {summary.map((group) => (
            <div key={group.label} className='flex justify-between gap-3'>
              <span className='font-semibold'>{group.label}</span>
              <span
                className={group.closed ? "text-muted-foreground" : undefined}
              >
                {group.hours}
              </span>
            </div>
          ))}
          {data.businessHours.note && (
            <p className='text-label text-muted-foreground'>
              {data.businessHours.note}
            </p>
          )}
        </CardContent>
      </Card>

      <section className='flex flex-col gap-3'>
        <SectionHeading>등원일 선택</SectionHeading>
        <p className='break-keep text-label text-muted-foreground'>
          유치원이 문을 여는 날만 고를 수 있습니다. 예약해도 이용권은 바로
          차감되지 않고, 아이가 실제로 등원한 날에 1회 차감됩니다.
        </p>

        <Calendar
          mode='multiple'
          selected={[...reservedDates, ...picked].map(fromDateKey)}
          onSelect={replacePicked}
          month={cursor}
          onMonthChange={jumpToMonth}
          locale={ko}
          /* 지난 달로는 가지 않는다 — 고를 수 있는 날이 하나도 없어 빈 달력만 보여주게
             되고, 그건 "왜 아무것도 안 눌리지"로 읽힌다. */
          startMonth={new Date()}
          disabled={isDisabled}
          /* 옆 달 날짜는 숨긴다 — 이 달력이 판정을 받아 온 범위가 이 달뿐이라,
             옆 달 칸은 잠글 근거도 열 근거도 없다. */
          showOutsideDays={false}
          /* 셀 44px 은 job-052 의 타협값(64px 을 그대로 쓰면 한 달이 화면을 넘긴다). */
          className='w-full [--cell-size:--spacing(11)] p-0'
          components={{
            /*
              날짜 버튼이 칸(td)을 정확히 채우게 한다.

              기본 `CalendarDayButton` 에는 `min-w-(--cell-size)`(44px)가 걸려 있는데,
              칸의 실제 폭은 달력 폭을 7로 나눈 값이라 좁은 화면에서 그보다 작아진다.
              그러면 **버튼이 칸보다 넓어져** 눌리는 면과 선택 시 칠해지는 면이 칸 밖으로
              삐져나온다. 그 하한만 푼다 — 폭은 `w-full`, 높이는 `aspect-square` 가
              이미 칸과 같은 값을 만든다.

              ⚠️ `absolute` 로 덮으면 안 된다. 칸 높이(`h-full`)와 주 행 높이가 **버튼의
              in-flow 높이에서** 나오므로, 버튼을 흐름에서 빼면 행이 0 으로 무너져 날짜가
              전부 위로 몰린다. `size-full`(=`h-full`)도 같은 이유로 위험하다 — 칸 높이가
              확정되지 않으면 `auto` 로 풀려 글자 높이만 남는다.

              모양(variant·색·반경·가운데 정렬)은 기본 컴포넌트가 그대로 갖는다.
            */
            DayButton: (props) => (
              <CalendarDayButton {...props} locale={ko} className='min-w-0' />
            ),
          }}
        />

        {/*
          이 달의 임시 휴무일 — 달력에서 잠긴 날에 **사유**를 붙여 준다 (job-060).
          사유 없이 잠그기만 하면 보호자는 전부 똑같이 "왜 안 눌리지"로 읽고 매장에
          전화한다. "설 연휴"라고 적혀 있으면 그 전화가 없다.
        */}
        {closedDays.length > 0 && (
          <div className='flex flex-col gap-2 rounded-btn border p-4'>
            <span className='font-semibold'>이 달의 휴무 안내</span>
            {closedDays.map((day) => (
              <span key={day.date} className='text-label text-muted-foreground'>
                {day.date} · {day.closedReason ?? "임시 휴무"}
              </span>
            ))}
          </div>
        )}

        {picked.length > 0 && (
          <div className='flex flex-col gap-2 rounded-btn bg-muted p-4'>
            <span className='font-semibold'>선택한 날 {picked.length}일</span>
            <span className='text-label text-muted-foreground'>
              {picked.join(", ")}
            </span>
          </div>
        )}

        {remainingAfterPick <= 0 && picked.length === 0 && (
          <p className='break-keep text-label text-caution-text'>
            {
              RESERVATION_BLOCK_MESSAGE[
                data.balance <= 0
                  ? RESERVATION_BLOCK.NO_BALANCE
                  : RESERVATION_BLOCK.SCHEDULE_FULL
              ]
            }
          </p>
        )}

        <Button
          onClick={() => {
            create.mutate(
              { dates: picked },
              // 성공했을 때만 선택을 비운다. 실패했는데 지우면 보호자는 무엇을 골랐는지
              // 잊은 채 처음부터 다시 골라야 한다.
              { onSuccess: () => setPicked([]) },
            );
          }}
          disabled={picked.length === 0 || create.isPending}
          size='lg'
        >
          {create.isPending ? <Spinner className='size-5' /> : null}
          {picked.length > 0
            ? `${picked.length}일 예약하기`
            : "날짜를 선택하세요"}
        </Button>
      </section>

      {cancelableDays.length > 0 && (
        <section className='flex flex-col gap-3'>
          <SectionHeading>내가 예약한 날</SectionHeading>
          {cancelableDays.map((day) => (
            <div
              key={day.date}
              className='flex items-center justify-between gap-3 rounded-btn border p-4'
            >
              <div className='flex flex-col gap-1'>
                <span className='font-semibold'>{day.date}</span>
                {day.hours && (
                  <span className='text-label text-muted-foreground'>
                    {day.hours}
                  </span>
                )}
              </div>
              <Button
                type='button'
                variant='outline'
                onClick={() => cancel.mutate(day.date)}
                disabled={cancel.isPending}
              >
                취소
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* 원장이 지정한 등원일은 취소 버튼 없이 알려만 준다. 안 보여주면 보호자는 그 날을
          예약하려다 "이미 등원 예정"이라는 이유로 막히는 이유를 알 수 없다. */}
      {reservedDates.length > cancelableDays.length && (
        <p className='text-label text-muted-foreground'>
          유치원이 지정한 등원일은 이 화면에서 취소할 수 없습니다. 변경이
          필요하면 유치원에 문의해주세요.
        </p>
      )}
    </div>
  );
};
