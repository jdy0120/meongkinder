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
  Label,
  Button,
  Card,
  CardContent,
  CardHeader,
} from "@pawlog/ui";
import type { TenantSubscriptionDetail } from "@pawlog/shared";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { SubscriptionStatusBadge } from "@/entities/subscription";
import { ListSkeleton } from "@/shared/ui";

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * 구독 목록 위젯. 페이지네이션·검색 상태와 목록 조회(usePaginatedList)를 자체 소유한다.
 */
export const SubscriptionsTable = () => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = usePaginatedList<TenantSubscriptionDetail>(
    "subscriptions",
    "/v1/admin/subscriptions",
    { page, pageSize: 10, search, sort: "createdAt", order: "desc" },
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <Card>
      <CardHeader className='pb-3'>
        {/* placeholder 는 라벨이 아니다 — MembersTable 의 같은 주석 참고. */}
        <form
          onSubmit={handleSearch}
          role='search'
          className='flex max-w-sm gap-2'
        >
          <Label htmlFor='tenant-subscription-search' className='sr-only'>
            테넌트명 또는 서브도메인 검색
          </Label>
          <Input
            id='tenant-subscription-search'
            type='search'
            placeholder='테넌트명 또는 서브도메인 검색'
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchInput(e.target.value)
            }
          />
          <Button
            type='submit'
            variant='default'
            className='cursor-pointer'
          >
            검색
          </Button>
        </form>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton variant='row' count={6} label='구독 목록 불러오는 중' />
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-muted-foreground font-semibold'>
                    테넌트명
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    서브도메인
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    구독 상품
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    결제 금액
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    구독 만료일
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    다음 결제 예정일
                  </TableHead>
                  <TableHead className='text-muted-foreground font-semibold'>
                    상태
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items && data.items.length > 0 ? (
                  data.items.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className='font-medium'>
                        {sub.tenant?.name}
                      </TableCell>
                      <TableCell>
                        {sub.tenant?.subdomain}
                      </TableCell>
                      <TableCell className='font-medium'>
                        {sub.plan?.name}
                      </TableCell>
                      <TableCell>
                        {sub.plan?.price.toLocaleString("ko-KR")}원
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {formatDate(sub.endDate)}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {formatDate(sub.nextPaymentDate)}
                      </TableCell>
                      <TableCell>
                        <SubscriptionStatusBadge status={sub.status} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className='text-center text-muted-foreground py-12'
                    >
                      구독 정보가 존재하지 않습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data?.meta && data.meta.totalPages > 1 && (
          <div className='mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <span className='text-sm text-muted-foreground'>
              총 {data.meta.total}건 중 {page} / {data.meta.totalPages} 페이지
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
               
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className='cursor-pointer'
              >
                이전
              </Button>
              <Button
                variant='outline'
               
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className='cursor-pointer'
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
