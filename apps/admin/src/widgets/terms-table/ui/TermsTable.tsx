"use client";

import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
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
      <Card className='border-slate-800 bg-slate-900/50 text-slate-100 backdrop-blur-sm rounded-2xl'>
        <CardHeader className='pb-3 flex flex-row items-center justify-between gap-4'>
          <div className='flex gap-2 max-w-sm w-full'>
            <Input
              type='text'
              inputSize='sm'
              placeholder='약관명, 구분 또는 버전 검색'
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              className='border-slate-800 bg-slate-950 text-slate-200 placeholder-slate-500 focus:ring-blue-500 rounded-xl'
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex justify-center items-center py-20'>
              <Spinner className='w-8 h-8 text-blue-500' />
            </div>
          ) : (
            <div
              ref={scrollRef}
              className='relative max-h-[60vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950/20 [&_[data-slot=table-container]]:overflow-visible'
            >
              <Table>
                <TableHeader className='border-b border-slate-800'>
                  <TableRow className='[&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-slate-950'>
                    <TableHead className='text-slate-400 font-semibold py-4'>
                      구분
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      약관명
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      버전
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      필수 동의
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      활성 상태
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      첨부 파일
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      등록일
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold text-right pr-6'>
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
                            ? "sticky z-10 border-emerald-500/20 bg-slate-900 hover:bg-slate-900"
                            : "border-slate-800/60 hover:bg-slate-800/10"
                        }`}
                      >
                        <TableCell className='py-4'>
                          <TermsCategoryBadge type={t.type} />
                        </TableCell>
                        <TableCell className='font-semibold text-slate-200'>
                          {t.title}
                        </TableCell>
                        <TableCell className='text-slate-300 font-mono'>
                          v{t.version}
                        </TableCell>
                        <TableCell>
                          {t.isRequired ? (
                            <Badge className='bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20 rounded-lg'>
                              필수
                            </Badge>
                          ) : (
                            <Badge className='bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border-slate-500/20 rounded-lg'>
                              선택
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.isActive ? (
                            <div className='flex items-center gap-1.5 text-emerald-400 text-sm font-medium'>
                              <CheckCircle className='w-4 h-4' />
                              사용 중
                            </div>
                          ) : (
                            <div className='flex items-center gap-1.5 text-slate-500 text-sm font-medium'>
                              <XCircle className='w-4 h-4' />
                              대기
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.file ? (
                            <div
                              className='flex items-center gap-1.5 text-slate-300 text-sm max-w-[180px] truncate'
                              title={t.file.originalName}
                            >
                              <FileText className='w-4 h-4 text-slate-500 shrink-0' />
                              <span className='truncate'>
                                {t.file.originalName}
                              </span>
                            </div>
                          ) : (
                            <span className='text-slate-600 text-sm'>
                              파일 없음
                            </span>
                          )}
                        </TableCell>
                        <TableCell className='text-slate-400 text-sm'>
                          {new Date(t.createdAt).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className='text-right pr-6 py-4'>
                          <div className='flex items-center justify-end gap-3'>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => setPreviewId(t.id)}
                              className='border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-8 px-3 text-xs gap-1'
                            >
                              <Eye className='w-3.5 h-3.5' />
                              본문 보기
                            </Button>

                            <div className='flex items-center gap-2'>
                              <Switch
                                checked={t.isActive}
                                onCheckedChange={() =>
                                  toggleActive.mutate({
                                    id: t.id,
                                    active: !t.isActive,
                                  })
                                }
                                disabled={toggleActive.isPending}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className='text-center text-slate-500 py-16'
                      >
                        검색 조건에 맞는 약관 버전이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TermsPreviewDialog
        previewId={previewId}
        onClose={() => setPreviewId(null)}
      />
    </>
  );
};
