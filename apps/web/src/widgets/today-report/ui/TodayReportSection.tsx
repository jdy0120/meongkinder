"use client";
import Link from "next/link";

import { PawPrint } from "lucide-react";
import { Spinner } from "@pawlog/ui";
import type { DailyReportWithPetAndContents } from "@pawlog/shared";

import { Button } from "@pawlog/ui";
import { EmptyState } from "@/shared/ui";
import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import { ReportCard } from "@/entities/daily-report";

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * 오늘의 리포트 섹션 (widget) — 오늘 날짜로 발행된 리포트를 자체 조회해 보여준다.
 * 여러 아이를 등록한 경우 발행된 모든 아이의 오늘 리포트가 함께 노출된다.
 */
export const TodayReportSection = () => {
  const { data, isLoading } = usePaginatedList<DailyReportWithPetAndContents>(
    "daily-reports-mine-today",
    "/v1/daily-reports/mine",
    { date: todayIso(), pageSize: 10, sort: "date", order: "desc" },
  );

  if (isLoading) {
    return (
      <div className='flex justify-center py-8'>
        <Spinner className='size-6' />
      </div>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return (
      <EmptyState
        icon={PawPrint}
        title='아직 오늘 소식이 없어요'
        description='하원 후 선생님이 알림장을 쓰면 알림톡으로 알려드릴게요.'
        action={
          <Button asChild variant='outline'>
            <Link href='/reports'>지난 알림장 보기</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      {data.items.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
};
