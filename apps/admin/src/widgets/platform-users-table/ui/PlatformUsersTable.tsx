"use client";

import React, { useState } from "react";
import {
  Badge,
  Button,
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
import { SearchField, TablePagination, TableToolbar } from "@/shared/ui";

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

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <section className='flex flex-col gap-5 rounded-2xl p-5 neu-raised'>
      <TableToolbar
        actions={
          <>
            <SearchField
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={handleSearch}
              placeholder='이메일·닉네임·전화번호 검색'
            />
            <CreatePlatformUserDialog />
          </>
        }
      >
        {/* 상태 탭 — 선택된 것은 채우지 않고 **눌린 면**으로 표시한다.
            채우면 오른쪽 "회원 등록"(주 행동)과 같은 무게가 되어 둘이 경쟁한다. */}
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            size='sm'
            variant='outline'
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`cursor-pointer border-transparent bg-transparent px-4 ${
              status === tab.value ? "neu-press-on" : "text-text-muted neu-press"
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </TableToolbar>

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
                  닉네임
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  이메일
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  연락처
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  소속 매장
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  가입일
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  상태
                </TableHead>
                <TableHead className='px-4 py-3 text-right text-label text-text-muted'>
                  작업
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items && data.items.length > 0 ? (
                data.items.map((user) => (
                  <TableRow
                    key={user.id}
                    className='border-border/60 hover:bg-muted/60'
                  >
                    <TableCell className='px-4 py-3 font-semibold text-foreground'>
                      <div className='flex items-center gap-2'>
                        {user.nickname}
                        {user.role === ROLES.SUPER_ADMIN && (
                          <RoleBadge role={user.role} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 text-text-muted'>
                      {user.email}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-text-muted tabular-nums'>
                      {/* 저장은 숫자만, 화면은 하이픈 (job-043). */}
                      {user.phone ? formatPhone(user.phone) : "—"}
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      {user.memberships.length === 0 ? (
                        <span className='text-meta text-text-meta'>없음</span>
                      ) : (
                        <div className='flex flex-wrap gap-1.5'>
                          {user.memberships.map((m) => (
                            <Badge
                              key={m.tenant.id}
                              variant='secondary'
                              className='text-text-muted'
                            >
                              {m.tenant.name} · {m.role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-text-meta'>
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <Badge
                        variant={
                          user.status === "SUSPENDED" ? "critical" : "normal"
                        }
                      >
                        {user.status === "SUSPENDED" ? "정지" : "정상"}
                      </Badge>
                    </TableCell>
                    <TableCell className='px-4 py-3 text-right'>
                      <PlatformUserActions user={user} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className='hover:bg-transparent'>
                  <TableCell
                    colSpan={7}
                    className='py-16 text-center text-text-meta'
                  >
                    검색된 회원이 없습니다.
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
          unit='명'
          onChange={setPage}
        />
      )}
    </section>
  );
};
