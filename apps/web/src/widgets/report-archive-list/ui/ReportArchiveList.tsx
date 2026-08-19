"use client";

import { useState } from "react";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pawlog/ui";
import type { DailyReportWithPetAndContents } from "@pawlog/shared";

import { EmptyState, ListSkeleton } from "@/shared/ui";
import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { usePets } from "@/entities/pet";
import { ReportCard } from "@/entities/daily-report";

const ALL_PETS = "ALL";

/**
 * 지난 리포트 아카이브 목록 (widget) — 펫 필터/페이지네이션 상태를 자체 소유하고
 * report-card 를 조합해 렌더링한다.
 */
export const ReportArchiveList = () => {
  const [page, setPage] = useState(1);
  const [petId, setPetId] = useState<string>(ALL_PETS);
  const { data: pets } = usePets();

  const { data, isLoading } = usePaginatedList<DailyReportWithPetAndContents>(
    "daily-reports-mine",
    "/v1/daily-reports/mine",
    {
      page,
      pageSize: 10,
      sort: "date",
      order: "desc",
      ...(petId !== ALL_PETS ? { petId } : {}),
    },
  );

  return (
    <div className='flex flex-col gap-4'>
      {pets && pets.length > 1 && (
        <Select
          value={petId}
          onValueChange={(value) => {
            setPetId(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder='아이 선택' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PETS}>전체 아이</SelectItem>
            {pets.map((pet) => (
              <SelectItem key={pet.id} value={pet.id}>
                {pet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isLoading ? (
        <ListSkeleton variant='card' count={4} label='지난 알림장 불러오는 중' />
      ) : data?.items && data.items.length > 0 ? (
        <div className='flex flex-col gap-3'>
          {data.items.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Newspaper}
          title='아직 지난 알림장이 없어요'
          description='유치원에서 알림장을 발행하면 여기에 하루씩 쌓입니다.'
          action={
            <Button asChild variant='outline'>
              <Link href='/app'>홈으로</Link>
            </Button>
          }
        />
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className='flex items-center justify-between pt-2'>
          <span className='text-xs text-muted-foreground'>
            {page} / {data.meta.totalPages} 페이지
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
             
              disabled={!data.meta.hasPrev}
              onClick={() => setPage((p) => p - 1)}
            >
              이전
            </Button>
            <Button
              variant='outline'
             
              disabled={!data.meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
