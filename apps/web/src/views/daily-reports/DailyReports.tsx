"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@pawlog/ui";

import { PageShell } from "@/shared/ui";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { DailyReportsTable } from "@/widgets/daily-reports-table";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 일일 리포트 관리 페이지 (view). 헤더 + 신규 작성 진입 버튼 + 목록 위젯 조합만 담당한다.
 */
export const DailyReportsPage = () => {
  // 매장 경로(/tenant/<subdomain>/…)를 유지한다.
  const { tenant } = useParams<{ tenant: string }>();

  return (
    <PageShell
      title='일일 리포트'
      description='아이별 일일 리포트를 작성하고 발행 상태를 확인합니다.'
      nav={<MobileNav />}
      desktopSidebar
      desktopWide
      action={
        <Button asChild className='gap-1.5'>
          <Link
            href={tenantPath(tenant, "daily-reports", "new")}
            aria-label='새 리포트 작성'
          >
            <Plus className='size-4' />
            {/* 좁은 화면에선 제목과 겹쳐 줄바꿈이 나므로 아이콘만 남긴다. */}
            <span className='hidden sm:inline'>새 리포트 작성</span>
          </Link>
        </Button>
      }
    >
      {/* DailyReportsTable 이 이미 Card 다. 예전엔 여기서 카드로 한 번 더 감싸
          테두리·배경이 이중으로 겹쳐 보였다. */}
      <DailyReportsTable />
    </PageShell>
  );
};
