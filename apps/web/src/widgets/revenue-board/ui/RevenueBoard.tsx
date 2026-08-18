"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pawlog/ui";
import {
  SALE_METHOD_LABELS,
  type MonthlyRevenueResponse,
  type RevenueSummaryResponse,
} from "@pawlog/shared";

import { Wallet } from "lucide-react";

import { EmptyState, StatTile } from "@/shared/ui";
import { RefundSaleDialog } from "@/features/subscription/refund-sale";
import { RevenueCalendarDialog } from "./RevenueCalendarDialog";
import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

const won = (value: number) => `${value.toLocaleString()}원`;

/**
 * 매출 화면 (job-051) — 매장 화면 `/tenant/[tenant]/revenue` 전용 위젯.
 *
 * ## 입금 기준이라는 것을 화면이 말해야 한다
 *
 * 10회권 20만원을 3월에 팔면 3월에 20만원 전부가 잡히고, 4월에 다 쓰더라도 4월은 0이다.
 * 이 규칙을 모르면 원장은 "이번 달 등원이 많았는데 왜 매출이 없지"라고 읽는다.
 * 그래서 숫자 옆에 기준을 명시한다 — 회계 용어("현금주의")가 아니라 평범한 말로.
 *
 * ## 여기 없는 것
 *
 * 원장이 pawlog 에 내는 매장 개설권 비용은 이 화면에 없다. 그건 유치원이 **번 돈**이
 * 아니라 **쓴 돈**이라, 한 숫자에 섞이면 둘 다 못 읽게 된다.
 */
export const RevenueBoard = () => {
  const tenantId = useTenantStore((state) => state.tenantId);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ["revenue-monthly", tenantId],
    queryFn: async () => {
      const res = await Get<MonthlyRevenueResponse, { months: number }>(
        "/v1/revenue/monthly",
        { months: 6 },
      );
      return res.data.data;
    },
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["revenue-summary", tenantId, year, month],
    queryFn: async () => {
      const res = await Get<
        RevenueSummaryResponse,
        { year: number; month: number }
      >("/v1/revenue/summary", { year, month });
      return res.data.data;
    },
  });

  const months = trend?.months ?? [];
  const peak = Math.max(1, ...months.map((m) => m.total));

  /** 달력을 띄울 달. 열려 있지 않으면 `null`. */
  const [calendarOf, setCalendarOf] = useState<{
    year: number;
    month: number;
  } | null>(null);

  /**
   * 막대 클릭 — **고르기와 열기를 함께** 한다 (job-063).
   *
   * 다른 달의 막대를 눌렀는데 아래 상세는 그대로 두고 달력만 그 달로 열리면, 한 화면에
   * 서로 다른 두 달이 동시에 보인다. 원장은 어느 쪽이 지금 보는 달인지 알 수 없다.
   */
  const openMonth = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    setCalendarOf({ year: y, month: m });
  };

  return (
    <div className='flex flex-col gap-6'>
      {/* 기준을 화면에 적어두는 이유는 위 주석 참고 — 모르면 숫자를 오해한다. */}
      <p className='break-keep text-xs text-muted-foreground'>
        받은 날짜 기준입니다. 10회권을 팔면 <b>판 달에 전액</b>이 잡히고, 아이가
        사용한 달에는 잡히지 않습니다.
      </p>

      {/* 최근 6개월 추이 — 막대를 CSS 높이로만 그린다. 차트 라이브러리를 쓸 만큼
          복잡한 정보가 아니고, 원장이 보는 건 "지난달보다 늘었나" 하나다. */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>최근 6개월</CardTitle>
          {/* 누를 수 있다는 것을 적어 준다 — 막대는 보통 그림이라 눌러 볼 생각을 하지 않는다. */}
          <p className='text-label text-muted-foreground'>
            월을 누르면 일별 매출 달력이 열립니다.
          </p>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className='flex justify-center py-6'>
              <Spinner />
            </div>
          ) : (
            <div className='flex items-end gap-2 overflow-x-auto'>
              {months.map((m) => {
                const isSelected = m.year === year && m.month === month;
                return (
                  <button
                    key={m.label}
                    type='button'
                    onClick={() => openMonth(m.year, m.month)}
                    aria-pressed={isSelected}
                    aria-label={`${m.month}월 일별 매출 보기`}
                    className='flex min-w-14 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-btn p-1 transition-colors hover:bg-accent'
                  >
                    <span className='text-xs text-muted-foreground'>
                      {m.total > 0 ? `${Math.round(m.total / 10000)}만` : "-"}
                    </span>
                    <span
                      className={`w-full rounded-xl transition-colors ${
                        isSelected ? "bg-primary" : "bg-muted"
                      }`}
                      style={{
                        height: `${Math.max(4, (m.total / peak) * 96)}px`,
                      }}
                    />
                    <span
                      className={`text-xs ${
                        isSelected
                          ? "font-semibold text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {m.month}월
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {summaryLoading ? (
        <div className='flex justify-center py-10'>
          <Spinner />
        </div>
      ) : !summary || summary.count === 0 ? (
        <EmptyState
          icon={Wallet}
          title={`${month}월에는 판매 기록이 없어요`}
          description='이용권을 판매하면 이 화면에 매출이 쌓입니다. 현금·계좌이체로 받은 것도 판매할 때 기록하면 함께 집계됩니다.'
        />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-3'>
            <StatTile
              label={`${summary.month}월 매출`}
              value={won(summary.total)}
            />
            <StatTile label='판매 건수' value={`${summary.count}건`} />
          </div>

          {/* 환불이 있을 때만 보여준다 (job-054). 매출이 줄었을 때 그 이유가 판매 부진인지
              환불인지 구분되지 않으면 원장이 잘못된 판단을 한다. 0원일 때는 굳이 자리를
              차지하지 않는다 — 대부분의 달은 환불이 없다. */}
          {summary.refunded > 0 && (
            <p className='break-keep text-xs text-muted-foreground'>
              이 달 환불 <b>{won(summary.refunded)}</b> 이 위 매출에서 이미
              차감되어 있습니다.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>결제수단별</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-2'>
              {summary.byMethod.map((row) => (
                <div
                  key={row.method}
                  className='flex items-center justify-between text-sm'
                >
                  <span className='text-muted-foreground'>
                    {SALE_METHOD_LABELS[row.method]} · {row.count}건
                  </span>
                  <span className='font-medium'>{won(row.total)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>요금제별</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-2'>
              {summary.byPlan.map((row) => (
                <div
                  key={row.planId ?? "deleted"}
                  className='flex items-center justify-between text-sm'
                >
                  <span className='text-muted-foreground'>
                    {row.planName} · {row.count}건
                  </span>
                  <span className='font-medium'>{won(row.total)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>판매 내역</CardTitle>
            </CardHeader>
            <CardContent className='overflow-x-auto p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead>원생</TableHead>
                    <TableHead>요금제</TableHead>
                    <TableHead>수단</TableHead>
                    <TableHead className='text-right'>금액</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.sales.map((sale) => {
                    const isRefunded = sale.refundedAmount > 0;
                    return (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {new Date(sale.soldAt).toLocaleDateString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>{sale.petName ?? "-"}</TableCell>
                        <TableCell>
                          {sale.planName ?? "삭제된 요금제"}
                          {isRefunded && (
                            <span className='ml-1.5 text-xs text-destructive'>
                              환불 {won(sale.refundedAmount)}
                              {sale.refundReason ? ` · ${sale.refundReason}` : ""}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{SALE_METHOD_LABELS[sale.method]}</TableCell>
                        {/* 환불된 건은 원금에 취소선을 긋고 순액을 함께 보여준다 —
                            "얼마 받았는데 얼마 남았나"가 한 줄에서 읽혀야 한다. */}
                        <TableCell className='text-right font-medium'>
                          {isRefunded ? (
                            <span className='flex flex-col items-end'>
                              <span className='text-xs text-muted-foreground line-through'>
                                {won(sale.amount)}
                              </span>
                              <span>
                                {won(sale.amount - sale.refundedAmount)}
                              </span>
                            </span>
                          ) : (
                            won(sale.amount)
                          )}
                        </TableCell>
                        <TableCell className='text-right'>
                          <RefundSaleDialog sale={sale} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
      {calendarOf && (
        <RevenueCalendarDialog
          open
          onOpenChange={(next: boolean) => !next && setCalendarOf(null)}
          year={calendarOf.year}
          month={calendarOf.month}
        />
      )}
    </div>
  );
};
