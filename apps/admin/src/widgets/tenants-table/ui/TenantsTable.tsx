"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Spinner,
} from "@pawlog/ui";
import type { TenantSummary } from "@pawlog/shared";

import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { TenantStatusBadge } from "@/entities/tenant";
import { EditTenantDialog } from "@/features/tenant/update-tenant";
import { TenantActiveToggle } from "@/features/tenant/toggle-tenant-active";
import { SearchField, TablePagination, TableToolbar } from "@/shared/ui";

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * 테넌트(가맹점) 목록 위젯 — SUPER_ADMIN 전용.
 * 페이지네이션·검색 상태와 목록 조회를 자체 소유하고, 상태 뱃지(entity)와
 * 정보 수정·활성 토글(feature)을 조합한다.
 */
export const TenantsTable = () => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = usePaginatedList<TenantSummary>(
    "tenants",
    "/v1/tenants",
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
            placeholder='매장 이름 또는 서브도메인 검색'
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
                  매장 이름
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  서브도메인
                </TableHead>
                <TableHead className='px-4 py-3 text-right text-label text-text-muted'>
                  사용자
                </TableHead>
                <TableHead className='px-4 py-3 text-right text-label text-text-muted'>
                  원생
                </TableHead>
                <TableHead className='px-4 py-3 text-label text-text-muted'>
                  생성일
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
                data.items.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className='border-border/60 hover:bg-muted/60'
                  >
                    <TableCell className='px-4 py-3 font-semibold text-foreground'>
                      {tenant.name}
                    </TableCell>
                    <TableCell className='px-4 py-3 font-mono text-meta text-text-muted'>
                      {tenant.subdomain}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-right text-text-muted tabular-nums'>
                      {tenant._count.memberships}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-right text-text-muted tabular-nums'>
                      {tenant._count.pets}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-text-meta'>
                      {formatDate(tenant.createdAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <div className='flex items-center gap-2.5'>
                        <TenantActiveToggle
                          tenant={{
                            id: tenant.id,
                            name: tenant.name,
                            isActive: tenant.isActive,
                          }}
                        />
                        <TenantStatusBadge isActive={tenant.isActive} />
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 text-right'>
                      <EditTenantDialog
                        tenant={{
                          id: tenant.id,
                          name: tenant.name,
                          subdomain: tenant.subdomain,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className='hover:bg-transparent'>
                  <TableCell
                    colSpan={7}
                    className='py-16 text-center text-text-meta'
                  >
                    검색된 테넌트가 없습니다.
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
          unit='개'
          onChange={setPage}
        />
      )}
    </section>
  );
};
