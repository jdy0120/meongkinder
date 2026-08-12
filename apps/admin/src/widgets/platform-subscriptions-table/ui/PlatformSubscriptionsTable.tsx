"use client";

import React, { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pawlog/ui";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";

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

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  CANCELED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  EXPIRED: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  FAIL_PAUSED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "이용중",
  CANCELED: "해지예정",
  EXPIRED: "만료",
  FAIL_PAUSED: "결제실패",
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <Card className='border-slate-800 bg-slate-900/50 text-slate-100 backdrop-blur-sm'>
      <CardHeader className='pb-3'>
        <form onSubmit={handleSearch} className='flex max-w-sm gap-2'>
          <Input
            type='text'
            inputSize='sm'
            placeholder='구매자 이메일 또는 매장 이름 검색'
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchInput(e.target.value)
            }
            className='border-slate-800 bg-slate-950 text-slate-200 placeholder-slate-500 focus:ring-blue-500'
          />
          <Button
            type='submit'
            size='sm'
            className='cursor-pointer bg-blue-600 text-white hover:bg-blue-700'
          >
            검색
          </Button>
        </form>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <Spinner className='h-8 w-8 text-blue-500' />
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader className='border-slate-800'>
                <TableRow className='border-slate-800 hover:bg-transparent'>
                  <TableHead className='font-semibold text-slate-400'>
                    구매자
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    요금제
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    개설한 매장
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    다음 결제일
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    상태
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items && data.items.length > 0 ? (
                  data.items.map((seat) => (
                    <TableRow
                      key={seat.id}
                      className='border-slate-800/60 hover:bg-slate-800/30'
                    >
                      <TableCell>
                        <p className='font-medium text-white'>
                          {seat.user.nickname}
                        </p>
                        <p className='text-xs text-slate-500'>
                          {seat.user.email}
                        </p>
                      </TableCell>
                      <TableCell className='text-slate-300'>
                        {seat.plan.name}
                        <span className='ml-1 text-xs text-slate-500'>
                          ({seat.plan.price.toLocaleString("ko-KR")}원)
                        </span>
                      </TableCell>
                      <TableCell>
                        {seat.tenant ? (
                          <span className='text-slate-300'>
                            {seat.tenant.name}
                          </span>
                        ) : (
                          <Badge
                            variant='outline'
                            className='rounded-lg border-slate-700 bg-slate-800/60 text-xs text-slate-400'
                          >
                            미사용
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-slate-400'>
                        {formatDate(seat.nextPaymentDate)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className={`rounded-lg border text-xs ${
                            STATUS_STYLES[seat.status] ??
                            "border-slate-700 bg-slate-800/60 text-slate-400"
                          }`}
                        >
                          {STATUS_LABELS[seat.status] ?? seat.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='py-12 text-center text-slate-500'
                    >
                      구독 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data?.meta && data.meta.totalPages > 1 && (
          <div className='mt-6 flex items-center justify-between border-t border-slate-800/60 pt-4'>
            <span className='text-sm text-slate-400'>
              총 {data.meta.total}건 중 {page} / {data.meta.totalPages} 페이지
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className='cursor-pointer border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white'
              >
                이전
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className='cursor-pointer border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white'
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
