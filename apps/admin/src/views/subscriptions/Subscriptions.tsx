"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  Spinner,
} from "@template/ui";
import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import type { UserSubscriptionDetail } from "@template/shared";

export const SubscriptionsPage = () => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = usePaginatedList<UserSubscriptionDetail>(
    "subscriptions",
    "/v1/admin/subscriptions",
    {
      page,
      pageSize: 10,
      search,
      sort: "createdAt",
      order: "desc",
    },
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className='bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20'>
            활성
          </Badge>
        );
      case "CANCELED":
        return (
          <Badge className='bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20'>
            해지예정
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge className='bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20'>
            만료
          </Badge>
        );
      case "FAIL_PAUSED":
        return (
          <Badge className='bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20'>
            결제실패 보류
          </Badge>
        );
      default:
        return (
          <Badge className='bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border-slate-500/20'>
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          구독 관리
        </h1>
        <p className='text-slate-400 text-sm'>
          유저들의 현재 요금제 구독 현황 및 다음 정기 결제 일정을
          모니터링합니다.
        </p>
      </div>

      <Card className='border-slate-800 bg-slate-900/50 text-slate-100 backdrop-blur-sm'>
        <CardHeader className='pb-3'>
          <form onSubmit={handleSearch} className='flex gap-2 max-w-sm'>
            <Input
              type='text'
              placeholder='이메일 또는 닉네임 검색'
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className='border-slate-800 bg-slate-950 text-slate-200 placeholder-slate-500 focus:ring-blue-500'
            />
            <Button
              type='submit'
              variant='default'
              className='bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
            >
              검색
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex justify-center items-center py-12'>
              <Spinner className='w-8 h-8 text-blue-500' />
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader className='border-slate-800'>
                  <TableRow className='border-slate-800 hover:bg-transparent'>
                    <TableHead className='text-slate-400 font-semibold'>
                      닉네임
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      이메일
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      구독 상품
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      결제 금액
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      구독 만료일
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      다음 결제 예정일
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      상태
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items && data.items.length > 0 ? (
                    data.items.map((sub) => (
                      <TableRow
                        key={sub.id}
                        className='border-slate-800/60 hover:bg-slate-800/30'
                      >
                        <TableCell className='font-medium text-white'>
                          {sub.user?.nickname}
                        </TableCell>
                        <TableCell className='text-slate-300'>
                          {sub.user?.email}
                        </TableCell>
                        <TableCell className='text-slate-200 font-medium'>
                          {sub.plan?.name}
                        </TableCell>
                        <TableCell className='text-slate-200'>
                          {sub.plan?.price.toLocaleString("ko-KR")}원
                        </TableCell>
                        <TableCell className='text-slate-400'>
                          {new Date(sub.endDate).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className='text-slate-400'>
                          {new Date(sub.nextPaymentDate).toLocaleDateString(
                            "ko-KR",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='text-center text-slate-500 py-12'
                      >
                        구독 정보가 존재하지 않습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className='flex items-center justify-between mt-6 pt-4 border-t border-slate-800/60'>
              <span className='text-sm text-slate-400'>
                총 {data.meta.total}건 중 {page} / {data.meta.totalPages} 페이지
              </span>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className='border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer'
                >
                  이전
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className='border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer'
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
