"use client";

import { useState } from "react";
import type { SubscriptionLedger } from "@pawlog/database";
import { Button, Spinner } from "@pawlog/ui";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { ledgerTypeLabelMap } from "@/entities/subscription";

/**
 * 충전(+)과 사용(-)의 색.
 *
 * job-052: emerald/red 하드코딩 → 토큰. 충전은 좋은 일이라 primary, 차감은 잔액이 줄어드는
 * 일이라 caution 이다. **차감을 danger 로 두지 않는다** — 정상 이용인데 매번 빨간 줄이
 * 뜨면 진짜 문제(잔액 0)가 묻힌다.
 */
const AMOUNT_STYLES: Record<string, string> = {
  positive: "text-primary",
  negative: "text-caution-text",
};

/** 정기권/회수권 사용 내역 (widget) — widget-private) — 특정 subscriptionId 의 충전/사용/환불/소멸 내역을 자체 조회한다. */
export const UsageHistorySection = ({ subscriptionId }: { subscriptionId: string }) => {
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePaginatedList<SubscriptionLedger>(
    `subscription-usage-history-${subscriptionId}`,
    `/v1/subscriptions/${subscriptionId}/usage-history`,
    { page, pageSize: 10, sort: "createdAt", order: "desc" },
  );

  if (isLoading) {
    return (
      <div className='flex justify-center py-5'>
        <Spinner className='size-5' />
      </div>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return <p className='py-5 text-center text-sm text-muted-foreground'>사용 내역이 없어요.</p>;
  }

  return (
    <div className='flex flex-col gap-2'>
      {data.items.map((ledger) => (
        <div
          key={ledger.id}
          className='flex items-center justify-between rounded-xl border p-3 text-sm'
        >
          <div>
            <p className='font-medium'>
              {ledgerTypeLabelMap[ledger.type] ?? ledger.type}
              {ledger.description ? ` · ${ledger.description}` : ""}
            </p>
            <p className='text-xs text-muted-foreground'>
              {new Date(ledger.createdAt).toLocaleString("ko-KR")}
            </p>
          </div>
          <div className='text-right'>
            <p
              className={
                ledger.amount >= 0 ? AMOUNT_STYLES.positive : AMOUNT_STYLES.negative
              }
            >
              {ledger.amount >= 0 ? `+${ledger.amount}` : ledger.amount}
            </p>
            <p className='text-xs text-muted-foreground'>잔여 {ledger.balanceAfter}</p>
          </div>
        </div>
      ))}

      {data.meta.totalPages > 1 && (
        <div className='flex items-center justify-between pt-2'>
          <span className='text-xs text-muted-foreground'>
            {page} / {data.meta.totalPages} 페이지
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
             
              disabled={!data.meta.hasPrev}
              onClick={() => setPage((p) => p - 1)}
            >
              이전
            </Button>
            <Button
              variant='outline'
             
              disabled={!data.meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
