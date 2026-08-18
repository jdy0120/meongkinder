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
      const res = await Get<DailyRevenueResponse, { year: number; month: number }>(
        "/v1/revenue/daily",
        { year, month },
      );
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
      {/* 화면을 거의 덮는다 — 칸마다 숫자가 세 줄이라 좁으면 읽을 수 없다. */}
      <DialogContent className='max-h-[92vh] w-[96vw] max-w-5xl overflow-y-auto rounded-2xl'>
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
          <Calendar
            mode='single'
            month={cursor}
            locale={ko}
            /* 이 달의 매출만 받아 왔으므로 옆 달 칸은 그릴 근거가 없다. */
            showOutsideDays={false}
            /* 달 이동을 막는다 — 어느 달을 보고 있는지는 위 막대가 정한다. */
            disableNavigation
            className='w-full [--cell-size:--spacing(20)] p-0'
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
                    className='flex aspect-square size-auto w-full min-w-(--cell-size) flex-col items-center justify-start gap-0.5 rounded-btn border p-1 disabled:opacity-100'
                  >
                    <span className='text-label font-semibold'>
                      {day.date.getDate()}
                    </span>

                    {row && (
                      <span className='flex w-full flex-col items-end gap-0 leading-tight'>
                        {/* 수익 — 초록 */}
                        <span className='w-full truncate text-right text-[11px] font-semibold text-success-text'>
                          {compact(row.gross)}
                        </span>
                        {/* 환불 — 빨강. 0원이어도 자리를 지운다(줄이 밀리면 세 줄의
                            위치가 날마다 달라져 한눈에 비교되지 않는다). */}
                        <span
                          className={`w-full truncate text-right text-[11px] font-semibold ${
                            row.refunded > 0 ? "text-danger" : "text-transparent"
                          }`}
                        >
                          {row.refunded > 0 ? `-${compact(row.refunded)}` : "0"}
                        </span>
                        {/* 총 매출 — 검정 */}
                        <span className='w-full truncate border-t pt-0.5 text-right text-[11px] font-bold text-foreground'>
                          {compact(row.total)}
                        </span>
                      </span>
                    )}
                  </button>
                );
              },
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
