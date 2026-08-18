"use client";

import { useMemo } from "react";
import { ko } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@pawlog/ui";
import type { DailyRevenueItem, DailyRevenueResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/** 달력 칸은 좁다. 10,000 단위로 접고 만 원 미만은 천 단위까지만 보여준다. */
const compact = (value: number) => {
  if (value === 0) return "0";
  if (Math.abs(value) >= 10000) {
    const man = value / 10000;
    // 12.3만 처럼 소수 한 자리까지. 정수면 소수점을 붙이지 않는다.
    return `${Number.isInteger(man) ? man : man.toFixed(1)}만`;
  }
  return value.toLocaleString();
};

interface RevenueCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
}

/**
 * 월 매출 달력 (job-063) — 매출 화면에서 "N월" 막대를 누르면 열린다.
 *
 * ## 왜 달력인가
 *
 * 월 합계는 "얼마 벌었나"에 답하지만 **"언제 버는가"** 에는 답하지 못한다. 원장이 실제로
 * 궁금해하는 건 재등록이 몰리는 날(월초·월말)과 아무도 결제하지 않은 구간이고, 그건 표를
 * 날짜순으로 훑어서는 잘 안 보인다. 달력은 요일과 주 단위 리듬을 공짜로 보여준다.
 *
 * ## 세 줄을 다 적는 이유
 *
 * 순매출만 적으면 "그날 0원"이 **판매가 없었다**인지 **팔고 전액 환불했다**인지 구분되지
 * 않는다. 원장에게 그 둘은 완전히 다른 하루다.
 *
 * ⚠️ 날짜 접기는 **서버가** 한다(`GET v1/revenue/daily`). 화면에서 `soldAt`(UTC ISO)을
 * 접으면 KST 09시 이전 판매가 전날로 붙어, 같은 화면의 월 합계와 어긋난다.
 */
export const RevenueCalendarDialog = ({
  open,
  onOpenChange,
  year,
  month,
}: RevenueCalendarDialogProps) => {
  const tenantId = useTenantStore((state) => state.tenantId);

  const { data, isLoading } = useQuery({
    queryKey: ["revenue-daily", tenantId, year, month],
    queryFn: async () => {
      const res = await Get<
        DailyRevenueResponse,
        { year: number; month: number }
      >("/v1/revenue/daily", { year, month });
      return res.data.data;
    },
    // 닫혀 있으면 부르지 않는다 — 매출 화면을 여는 것만으로 12번의 요청이 생기면 안 된다.
    enabled: open,
  });

  const byDate = useMemo(() => {
    const map = new Map<string, DailyRevenueItem>();
    for (const day of data?.days ?? []) map.set(day.date, day);
    return map;
  }, [data]);

  // 달력이 이 달을 보여주도록 고정한다. 누른 달의 매출을 보는 화면이라 달 이동은 없다.
  const cursor = new Date(year, month - 1, 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        화면을 거의 덮는다 — 칸 하나에 숫자가 세 줄이라 좁으면 읽을 수 없다.

        ⚠️ `sm:max-w-*` 를 함께 지정해야 한다. `DialogContent` 기본값에 `sm:max-w-sm` 이 들어
        있는데, Tailwind 는 특이도가 같으면 **나중에 선언된 것**이 이기므로 `max-w-*` 만
        얹으면 sm 이상에서 조용히 384px 로 되돌아간다.
      */}
      <DialogContent className='max-h-[92vh] w-[96vw] max-w-[1400px] overflow-hidden rounded-2xl sm:max-w-[1400px]'>
        <DialogHeader>
          <DialogTitle>
            {year}년 {month}월 일별 매출
          </DialogTitle>
          <DialogDescription>
            받은 날짜 기준입니다. 위에서부터 수익 · 환불 · 총 매출이며, 판매가
            없는 날은 비워 둡니다.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex justify-center py-16'>
            <Spinner className='size-8 text-primary' />
          </div>
        ) : (
          /*
            좁은 화면에서는 **가로로** 스크롤한다.
            7열 달력을 폭에 맞춰 줄이면 칸이 40px 밑으로 내려가 세 줄이 아예 안 읽힌다.
            읽히지 않는 표를 다 보여주는 것보다 밀어서 보는 편이 낫다.
          */
          <div className='overflow-x-auto'>
            <Calendar
              mode='single'
              month={cursor}
              locale={ko}
              /* 이 달의 매출만 받아 왔으므로 옆 달 칸은 그릴 근거가 없다. */
              showOutsideDays={false}
              /* 달 이동을 막는다 — 어느 달을 보고 있는지는 위 막대가 정한다. */
              disableNavigation
              /*
                세로 스크롤이 생기지 않도록 **칸 높이를 뷰포트에서 역산**한다.

                달력이 쌓는 줄은 8개다 — 상단 라벨 1 + 요일 1 + 주 6. 여기에 모달 패딩과
                헤더(제목·설명)를 빼면 한 줄이 쓸 수 있는 높이가 나온다. `vh` 로 묶어야
                노트북(768px)과 데스크톱(1080px)에서 같은 규칙으로 맞는다.

                하한 2.75rem 은 세 줄이 겨우 읽히는 크기이고, 상한 5.5rem 을 두는 이유는
                큰 화면에서 칸만 커지면 숫자 사이 여백이 벌어져 오히려 훑기 어려워지기
                때문이다.
              */
              className='w-full min-w-[42rem] p-0 [--cell-size:clamp(2.75rem,8.5vh,5.5rem)]'
              classNames={{
                /* 기본값은 주마다 `mt-2`(8px) — 6주면 48px 이 세로로 쌓여 스크롤을
                   만든다. 칸에 테두리가 있어 간격 없이도 줄이 구분된다. */
                week: "mt-0.5 flex w-full",
                month: "flex w-full flex-col gap-1",
                months: "relative flex flex-col gap-1",
              }}
              components={{
                DayButton: ({ day, ...props }) => {
                  const key = `${day.date.getFullYear()}-${`${day.date.getMonth() + 1}`.padStart(2, "0")}-${`${day.date.getDate()}`.padStart(2, "0")}`;
                  const row = byDate.get(key);

                  return (
                    <button
                      {...props}
                      type='button'
                      /* 매출을 읽는 화면이지 고르는 화면이 아니다 — 누를 수 있는 것처럼
                       보이면 눌러 보고 아무 일도 없는 것을 확인하게 된다. */
                      disabled
                      className='flex h-(--cell-size) w-full min-w-(--cell-size) flex-col items-stretch justify-start gap-0.5 rounded-btn border p-1.5 disabled:opacity-100'
                    >
                      <span className='text-left text-label font-semibold'>
                        {day.date.getDate()}
                      </span>

                      {row && (
                        <span className='flex w-full flex-col items-end gap-0 leading-tight'>
                          {/* 수익 — 초록 */}
                          <span className='w-full truncate text-right text-label font-semibold text-success-text'>
                            {compact(row.gross)}
                          </span>
                          {/* 환불 — 빨강. 0원이어도 자리를 지운다(줄이 밀리면 세 줄의
                            위치가 날마다 달라져 한눈에 비교되지 않는다). */}
                          <span
                            className={`w-full truncate text-right text-label font-semibold ${
                              row.refunded > 0
                                ? "text-danger"
                                : "text-transparent"
                            }`}
                          >
                            {row.refunded > 0
                              ? `-${compact(row.refunded)}`
                              : "0"}
                          </span>
                          {/* 총 매출 — 검정 */}
                          <span className='w-full truncate border-t pt-0.5 text-right text-label font-bold text-foreground'>
                            {compact(row.total)}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                },
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
