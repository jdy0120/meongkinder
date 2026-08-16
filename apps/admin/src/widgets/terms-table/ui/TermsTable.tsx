"use client";

import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, CheckCircle, XCircle, Eye, Search } from "lucide-react";
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
  Spinner,
  Switch,
} from "@pawlog/ui";

import { Get } from "@/shared/libs/axios/request";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";
import {
  TermsCategoryBadge,
  typeLabelMap,
  type TermsItem,
} from "@/entities/terms";
import { useToggleTermsActive } from "@/features/terms/toggle-active";
import { TermsPreviewDialog } from "@/features/terms/preview-terms";

/**
 * 약관 목록 위젯. 전체 약관 조회·검색·활성 행 sticky 정렬을 자체 소유하고,
 * 카테고리 뱃지(entity)·활성 토글/본문 미리보기(feature)를 조합한다.
 */
export const TermsTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const tenantId = useTenantStore((state) => state.tenantId);

  const { data: termsList = [], isLoading } = useQuery<TermsItem[]>({
    queryKey: ["terms", "all", tenantId],
    queryFn: async () => {
      const res = await Get<TermsItem[], unknown>("/v1/admin/terms");
      return res.data.data || [];
    },
  });

  const toggleActive = useToggleTermsActive();

  const filteredTerms = useMemo(
    () =>
      termsList.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.version.includes(searchQuery) ||
          typeLabelMap[t.type]
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      ),
    [termsList, searchQuery],
  );

  // 사용 중(활성) 약관을 항상 목록 최상단으로 정렬한다.
  const sortedTerms = useMemo(
    () =>
      [...filteredTerms].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [filteredTerms],
  );

  // 활성 약관 행을 헤더 바로 아래에 sticky 로 고정하기 위해 top 오프셋을 런타임 측정한다.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickyTops, setStickyTops] = useState<number[]>([]);

  useLayoutEffect(() => {
    const recalc = () => {
      const container = scrollRef.current;
      if (!container) return;
      const headerH =
        container.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const rows = Array.from(
        container.querySelectorAll<HTMLTableRowElement>(
          "tbody tr[data-active='true']",
        ),
      );
      let acc = headerH;
      const tops = rows.map((row) => {
        const top = acc;
        acc += row.getBoundingClientRect().height;
        return top;
      });
      setStickyTops(tops);
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [sortedTerms]);

  return (
    <>
      <section className='flex flex-col gap-5 rounded-2xl p-5 neu-raised'>
        <div className='relative w-full max-w-sm'>
          <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-meta' />
          <Input
            type='text'
            inputSize='sm'
            placeholder='약관명, 구분 또는 버전 검색'
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
            className='rounded-xl border-transparent pl-9 neu-inset placeholder:text-text-meta'
          />
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-20'>
            <Spinner className='size-8 text-brand' />
          </div>
        ) : (
          <div
            ref={scrollRef}
            className='relative max-h-[60vh] overflow-auto rounded-2xl neu-inset [&_[data-slot=table-container]]:overflow-visible'
          >
            <Table>
              <TableHeader>
                {/* ⚠️ sticky 헤더는 아래 행이 그 밑을 지나가므로 **반드시 불투명**해야 한다.
                    투명하거나 반투명이면 스크롤할 때 행이 헤더 글자를 뚫고 올라와 겹쳐 보인다.
                    면 사다리: 표 안쪽(가장 어두움) < 헤더 < 활성 행(가장 밝음). */}
                <TableRow className='border-border hover:bg-transparent [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-secondary'>
                  <TableHead className='px-4 py-3.5 text-label text-text-muted'>
                    구분
                  </TableHead>
                  <TableHead className='px-4 py-3.5 text-label text-text-muted'>
                    약관명
                  </TableHead>
                  <TableHead className='px-4 py-3.5 text-label text-text-muted'>
                    버전
                  </TableHead>
                  <TableHead className='px-4 py-3.5 text-label text-text-muted'>
                    필수 동의
                  </TableHead>
                  <TableHead className='px-4 py-3.5 text-label text-text-muted'>
                    활성 상태
                  </TableHead>
                  <TableHead className='px-4 py-3.5 text-label text-text-muted'>
                    첨부 파일
                  </TableHead>
                  <TableHead className='px-4 py-3.5 text-label text-text-muted'>
                    등록일
                  </TableHead>
                  <TableHead className='px-4 py-3.5 pr-5 text-right text-label text-text-muted'>
                    작업
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTerms.length > 0 ? (
                  sortedTerms.map((t, idx) => (
                    <TableRow
                      key={t.id}
                      data-active={t.isActive ? "true" : undefined}
                      style={
                        t.isActive ? { top: stickyTops[idx] ?? 0 } : undefined
                      }
                      className={`border-b transition-colors ${
                        t.isActive
                          ? "sticky z-10 border-border bg-background hover:bg-background"
                          : "border-border/60 hover:bg-muted/60"
                      }`}
                    >
                      <TableCell className='px-4 py-3.5'>
                        <TermsCategoryBadge type={t.type} />
                      </TableCell>
                      <TableCell className='px-4 py-3.5 font-semibold text-foreground'>
                        {t.title}
                      </TableCell>
                      <TableCell className='px-4 py-3.5 font-mono text-text-muted tabular-nums'>
                        v{t.version}
                      </TableCell>
                      <TableCell className='px-4 py-3.5'>
                        <Badge variant={t.isRequired ? "caution" : "secondary"}>
                          {t.isRequired ? "필수" : "선택"}
                        </Badge>
                      </TableCell>
                      <TableCell className='px-4 py-3.5'>
                        {t.isActive ? (
                          <div className='flex items-center gap-1.5 text-body-sm font-semibold text-success-text'>
                            <CheckCircle className='size-4' />
                            사용 중
                          </div>
                        ) : (
                          <div className='flex items-center gap-1.5 text-body-sm text-text-meta'>
                            <XCircle className='size-4' />
                            대기
                          </div>
                        )}
                      </TableCell>
                      <TableCell className='px-4 py-3.5'>
                        {t.file ? (
                          <div
                            className='flex max-w-[180px] items-center gap-1.5 truncate text-body-sm text-text-muted'
                            title={t.file.originalName}
                          >
                            <FileText className='size-4 shrink-0 text-text-meta' />
                            <span className='truncate'>
                              {t.file.originalName}
                            </span>
                          </div>
                        ) : (
                          <span className='text-body-sm text-text-meta'>
                            파일 없음
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='px-4 py-3.5 text-body-sm text-text-meta'>
                        {new Date(t.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className='px-4 py-3.5 pr-5 text-right'>
                        <div className='flex items-center justify-end gap-3'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setPreviewId(t.id)}
                            className='cursor-pointer gap-1.5 border-transparent bg-transparent px-3 text-text-muted neu-press'
                          >
                            <Eye className='size-4' />
                            본문 보기
                          </Button>

                          <Switch
                            checked={t.isActive}
                            onCheckedChange={() =>
                              toggleActive.mutate({
                                id: t.id,
                                active: !t.isActive,
                              })
                            }
                            disabled={toggleActive.isPending}
                            aria-label={`${t.title} 활성 상태`}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className='hover:bg-transparent'>
                    <TableCell
                      colSpan={8}
                      className='py-20 text-center text-text-meta'
                    >
                      검색 조건에 맞는 약관 버전이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <TermsPreviewDialog
        previewId={previewId}
        onClose={() => setPreviewId(null)}
      />
    </>
  );
};
