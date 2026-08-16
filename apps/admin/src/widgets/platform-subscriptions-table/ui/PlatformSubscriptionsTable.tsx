"use client";

import React, { useState } from "react";
import {
  Badge,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pawlog/ui";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { SearchField, TablePagination, TableToolbar } from "@/shared/ui";

/** v1/platform/subscriptions 가 내려주는 항목 (매장 개설권 = SaaS 요금). */
interface SeatSubscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  nextPaymentDate: string;
  tenantId: string | null;
  user: { id: string; email: string; nickname: string };
  plan: { name: string; price: number; interval: string };
  tenant: { id: string; name: string; subdomain: string } | null;
}

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * 구독 상태 → 배지 긴급도.
 *
 * 예전에는 상태 4종에 각각 다른 색(emerald/amber/slate/rose)을 배정했는데, 그러면 색이
 * **분류**를 뜻하게 되어 "지금 봐야 하는 건"이 드러나지 않는다. 3단계로 접는다 —
 * 결제 실패만 critical 이고, 해지예정은 caution, 나머지는 색이 없다.
 */
const STATUS_META: Record<
  string,
  { label: string; variant: "normal" | "caution" | "critical" | "secondary" }
> = {
  ACTIVE: { label: "이용중", variant: "normal" },
  CANCELED: { label: "해지예정", variant: "caution" },
  EXPIRED: { label: "만료", variant: "secondary" },
  FAIL_PAUSED: { label: "결제실패", variant: "critical" },
};

/**
 * 전 플랫폼 매장 개설권 구독 현황 위젯 — SUPER_ADMIN 전용.
 * 매장이 연결되지 않은(tenantId=null) 건은 결제만 하고 아직 개설하지 않은 개설권이다.
 */
export const PlatformSubscriptionsTable = () => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = usePaginatedList<SeatSubscription>(
    "platform-subscriptions",
    "/v1/platform/subscriptions",
    { page, pageSize: 10, search, sort: "createdAt", order: "desc" },
  );

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <section className='flex flex-col gap-5 rounded-2xl p-5 neu-raised'>
      <TableToolbar
        actions={
          <SearchField
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={handleSearch}
            placeholder='구매자 이메일 또는 매장 이름 검색'
          />
        }
      />

      {isLoading ? (
        <div className='flex items-center justify-center py-16'>
          <Spinner className='size-8 text-brand' />
        </div>
      ) : (
        <div className='overflow-hidden rounded-2xl neu-inset'>
          <Table>
            <TableHeader>
              <TableRow className='border-border hover:bg-transparent'>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  구매자
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  요금제
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  개설한 매장
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  다음 결제일
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  상태
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items && data.items.length > 0 ? (
                data.items.map((seat) => {
                  const meta = STATUS_META[seat.status];
                  return (
                    <TableRow
                      key={seat.id}
                      className='border-border/60 hover:bg-muted/60'
                    >
                      <TableCell className='px-4 py-3'>
                        <p className='font-semibold text-foreground'>
                          {seat.user.nickname}
                        </p>
                        <p className='text-meta text-text-meta'>
                          {seat.user.email}
                        </p>
                      </TableCell>
                      <TableCell className='px-4 py-3 text-text-muted'>
                        {seat.plan.name}
                        <span className='ml-1 text-meta text-text-meta tabular-nums'>
                          ({seat.plan.price.toLocaleString("ko-KR")}원)
                        </span>
                      </TableCell>
                      <TableCell className='px-4 py-3'>
                        {seat.tenant ? (
                          <span className='text-text-muted'>
                            {seat.tenant.name}
                          </span>
                        ) : (
                          <Badge variant='secondary' className='text-text-meta'>
                            미사용
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='px-4 py-3 text-text-meta'>
                        {formatDate(seat.nextPaymentDate)}
                      </TableCell>
                      <TableCell className='px-4 py-3'>
                        <Badge variant={meta?.variant ?? "secondary"}>
                          {meta?.label ?? seat.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className='hover:bg-transparent'>
                  <TableCell
                    colSpan={5}
                    className='py-16 text-center text-text-meta'
                  >
                    구독 내역이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.meta && (
        <TablePagination
          page={page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          unit='건'
          onChange={setPage}
        />
      )}
    </section>
  );
};
