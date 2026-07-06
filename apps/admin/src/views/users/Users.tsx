"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  CardHeader,
  Spinner,
} from "@template/ui";
import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { Patch } from "@/shared/libs/axios/request";
import { ROLES } from "@template/shared";
import type { User } from "@template/database";

export const UsersPage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = usePaginatedList<User>("users", "/v1/admin/users", {
    page,
    pageSize: 10,
    search,
    sort: "createdAt",
    order: "desc",
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await Patch(`/v1/admin/users/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      toast.success("사용자 역할이 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "역할 변경에 실패했습니다.";
      toast.error(msg);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ id: userId, role: newRole });
  };

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          사용자 관리
        </h1>
        <p className='text-slate-400 text-sm'>
          서비스 가입 사용자들의 역할 변경 및 전체 사용자 현황을 조회할 수
          있습니다.
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
                      가입일
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold w-[160px]'>
                      역할
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
                          {new Date(user.createdAt).toLocaleDateString(
                            "ko-KR",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(val) =>
                              handleRoleChange(user.id, val)
                            }
                          >
                            <SelectTrigger className='w-32 border-slate-800 bg-slate-950 text-slate-200'>
                              <SelectValue placeholder='역할 선택' />
                            </SelectTrigger>
                            <SelectContent className='border-slate-800 bg-slate-950 text-slate-200'>
                              <SelectItem value={ROLES.USER}>
                                일반 사용자
                              </SelectItem>
                              <SelectItem value={ROLES.ADMIN}>
                                관리자
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
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

          {/* Pagination Controls */}
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
    </div>
  );
};
