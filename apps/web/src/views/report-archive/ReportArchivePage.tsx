import { PageShell } from "@/shared/ui";
import { ReportArchiveList } from "@/widgets/report-archive-list";
import { TodayReportSection } from "@/widgets/today-report";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 리포트 화면 (view) — 오늘의 리포트와 지난 리포트 아카이브를 조합해 보여준다.
 * 데이터 조회/상태 관리는 각 widget 이 자체 소유한다.
 */
export const ReportArchivePage = () => (
  <PageShell title='리포트' width='md' nav={<MobileNav />}>
    <section className='space-y-3'>
      <h2 className='text-sm font-semibold text-muted-foreground'>
        오늘의 리포트
      </h2>
      <TodayReportSection />
    </section>

    <section className='space-y-3'>
      <h2 className='text-sm font-semibold text-muted-foreground'>
        지난 리포트 아카이브
      </h2>
      <ReportArchiveList />
    </section>
  </PageShell>
);
