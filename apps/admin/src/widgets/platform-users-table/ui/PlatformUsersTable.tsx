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
import { formatPhone, ROLES, type MembershipRole } from "@pawlog/shared";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { RoleBadge } from "@/entities/user";
import { PlatformUserActions } from "@/features/platform/manage-user";
import { CreatePlatformUserDialog } from "@/features/platform/create-user";

/** v1/platform/users 가 내려주는 항목 — 소속 요약이 함께 온다. */
interface PlatformUser {
  id: string;
  email: string;
  nickname: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
  memberships: {
    role: MembershipRole;
    status: string;
    tenant: { id: string; name: string; subdomain: string };
  }[];
}

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const STATUS_TABS = [
  { value: "ALL", label: "전체" },
  { value: "ACTIVE", label: "정상" },
  { value: "SUSPENDED", label: "정지" },
];

/**
 * 전 플랫폼 회원 목록 위젯 — SUPER_ADMIN 전용.
 *
 * `v1/platform/*` 은 테넌트 스코프 밖이라, 매장 하나를 보고 있든 아니든 항상 전체가 나온다.
 * 소속 열은 그 회원이 어느 매장에 어떤 자격으로 있는지 한눈에 보여준다.
 */
export const PlatformUsersTable = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = usePaginatedList<PlatformUser>(
    "platform-users",
    "/v1/platform/users",
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

  return (
    <Card className='border-slate-800 bg-slate-900/50 text-slate-100 backdrop-blur-sm'>
      <CardHeader className='flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex gap-1.5'>
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              size='sm'
              variant={status === tab.value ? "default" : "outline"}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={
                status === tab.value
                  ? "cursor-pointer rounded-lg bg-blue-600 text-white hover:bg-blue-500"
                  : "cursor-pointer rounded-lg border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
              }
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <form onSubmit={handleSearch} className='flex max-w-sm gap-2'>
            <Input
              type='text'
              inputSize='sm'
              placeholder='이메일·닉네임·전화번호 검색'
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

          <CreatePlatformUserDialog />
        </div>
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
                    닉네임
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    이메일
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    연락처
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    소속 매장
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    가입일
                  </TableHead>
                  <TableHead className='font-semibold text-slate-400'>
                    상태
                  </TableHead>
                  <TableHead className='text-right font-semibold text-slate-400'>
                    작업
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items && data.items.length > 0 ? (
                  data.items.map((user) => (
                    <TableRow
                      key={user.id}
                      className='border-slate-800/60 hover:bg-slate-800/30'
                    >
                      <TableCell className='font-medium text-white'>
                        <div className='flex items-center gap-2'>
                          {user.nickname}
                          {user.role === ROLES.SUPER_ADMIN && (
                            <RoleBadge role={user.role} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='text-slate-300'>
                        {user.email}
                      </TableCell>
                      <TableCell className='text-slate-400'>
                        {/* 저장은 숫자만, 화면은 하이픈 (job-043). */}
                        {user.phone ? formatPhone(user.phone) : "—"}
                      </TableCell>
                      <TableCell>
                        {user.memberships.length === 0 ? (
                          <span className='text-xs text-slate-500'>없음</span>
                        ) : (
                          <div className='flex flex-wrap gap-1'>
                            {user.memberships.map((m) => (
                              <Badge
                                key={m.tenant.id}
                                variant='outline'
                                className='rounded-lg border-slate-700 bg-slate-800/60 text-xs text-slate-300'
                              >
                                {m.tenant.name} · {m.role}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className='text-slate-400'>
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className={`rounded-lg border text-xs ${
                            user.status === "SUSPENDED"
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {user.status === "SUSPENDED" ? "정지" : "정상"}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right'>
                        <PlatformUserActions user={user} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className='py-12 text-center text-slate-500'
                    >
                      검색된 회원이 없습니다.
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
              총 {data.meta.total}명 중 {page} / {data.meta.totalPages} 페이지
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
