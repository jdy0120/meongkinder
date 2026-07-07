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
  Card,
  CardContent,
  CardHeader,
  Spinner,
} from "@template/ui";
import type { UserWithAgreements } from "@template/shared";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { UserTermsBadges } from "@/entities/user";
import { RoleSelect } from "@/features/user/change-role";
import { EditUserDialog } from "@/features/user/edit-user";

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * 사용자 목록 위젯. 페이지네이션·검색 상태와 목록 조회를 자체 소유하고,
 * 약관 뱃지(entity)·역할 변경(feature)을 조합한다.
 */
export const UsersTable = () => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = usePaginatedList<UserWithAgreements>(
    "users",
    "/v1/admin/users",
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
        <form onSubmit={handleSearch} className='flex gap-2 max-w-sm'>
          <Input
            type='text'
            placeholder='이메일 또는 닉네임 검색'
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchInput(e.target.value)
            }
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
                    가입일
                  </TableHead>
                  <TableHead className='text-slate-400 font-semibold'>
                    약관 동의
                  </TableHead>
                  <TableHead className='text-slate-400 font-semibold w-[160px]'>
                    역할
                  </TableHead>
                  <TableHead className='text-slate-400 font-semibold text-right'>
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
                        {user.nickname}
                      </TableCell>
                      <TableCell className='text-slate-300'>
                        {user.email}
                      </TableCell>
                      <TableCell className='text-slate-400'>
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <UserTermsBadges agreements={user.termsAgreements} />
                      </TableCell>
                      <TableCell>
                        <RoleSelect userId={user.id} role={user.role} />
                      </TableCell>
                      <TableCell className='text-right'>
                        <EditUserDialog
                          user={{
                            id: user.id,
                            nickname: user.nickname,
                            status: user.status,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='text-center text-slate-500 py-12'
                    >
                      검색된 사용자가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data?.meta && data.meta.totalPages > 1 && (
          <div className='flex items-center justify-between mt-6 pt-4 border-t border-slate-800/60'>
            <span className='text-sm text-slate-400'>
              총 {data.meta.total}명 중 {page} / {data.meta.totalPages} 페이지
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
  );
};
