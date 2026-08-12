"use client";

import React, { useState } from "react";
import {
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
import {
  formatPhone,
  MEMBERSHIP_STATUS,
  type MembershipStatus,
  type MembershipWithUser,
} from "@pawlog/shared";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { MembershipStatusBadge } from "@/entities/membership";
import { RoleBadge } from "@/entities/user";
import { DecideMembershipActions } from "@/features/membership/decide-membership";
import {
  MemberRoleSelect,
  RemoveMemberButton,
} from "@/features/membership/manage-member";

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const STATUS_TABS: { value: MembershipStatus | "ALL"; label: string }[] = [
  { value: MEMBERSHIP_STATUS.PENDING, label: "승인 대기" },
  { value: MEMBERSHIP_STATUS.ACTIVE, label: "구성원" },
  { value: "ALL", label: "전체" },
];

/**
 * 구성원 목록 위젯 — 승인 대기와 정상 구성원을 상태 탭으로 나눠 보여준다.
 * 승인 대기 행에는 승인/반려만, 정상 구성원 행에는 역할 변경/내보내기만 노출한다.
 */
export const MembersTable = () => {
  const [status, setStatus] = useState<MembershipStatus | "ALL">(
    MEMBERSHIP_STATUS.PENDING,
  );
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = usePaginatedList<MembershipWithUser>(
    "memberships",
    "/v1/memberships",
    {
      page,
      pageSize: 10,
      search,
      sort: "createdAt",
      order: "desc",
      ...(status === "ALL" ? {} : { status }),
    },
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const isPendingView = status === MEMBERSHIP_STATUS.PENDING;

  return (
    <Card>
      <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex gap-1.5'>
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
             
              variant={status === tab.value ? "default" : "outline"}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSearch} className='flex max-w-sm gap-2'>
          <Input
            type='text'
            placeholder='이메일 또는 닉네임 검색'
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchInput(e.target.value)
            }
          />
          <Button type='submit'>검색</Button>
        </form>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <Spinner className='h-8 w-8' />
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>닉네임</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>{isPendingView ? "신청일" : "소속일"}</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className='w-[160px]'>자격</TableHead>
                  <TableHead className='text-right'>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items && data.items.length > 0 ? (
                  data.items.map((membership) => {
                    const isPending =
                      membership.status === MEMBERSHIP_STATUS.PENDING;
                    const isActive =
                      membership.status === MEMBERSHIP_STATUS.ACTIVE;

                    return (
                      <TableRow key={membership.id}>
                        <TableCell className='font-medium'>
                          {membership.user.nickname}
                        </TableCell>
                        <TableCell>{membership.user.email}</TableCell>
                        <TableCell className='text-muted-foreground'>
                          {formatPhone(membership.user.phone) || "—"}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {formatDate(membership.createdAt)}
                        </TableCell>
                        <TableCell>
                          <MembershipStatusBadge status={membership.status} />
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <MemberRoleSelect
                              membershipId={membership.id}
                              role={membership.role}
                            />
                          ) : (
                            <RoleBadge role={membership.role} />
                          )}
                        </TableCell>
                        <TableCell className='text-right'>
                          {isPending && (
                            <DecideMembershipActions
                              membershipId={membership.id}
                            />
                          )}
                          {isActive && (
                            <div className='flex justify-end'>
                              <RemoveMemberButton
                                membershipId={membership.id}
                                nickname={membership.user.nickname}
                              />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className='py-12 text-center text-muted-foreground'
                    >
                      {isPendingView
                        ? "승인 대기 중인 신청이 없습니다."
                        : "구성원이 없습니다."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data?.meta && data.meta.totalPages > 1 && (
          <div className='mt-6 flex items-center justify-between border-t pt-4'>
            <span className='text-sm text-muted-foreground'>
              총 {data.meta.total}명 중 {page} / {data.meta.totalPages} 페이지
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
               
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                이전
              </Button>
              <Button
                variant='outline'
               
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
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
