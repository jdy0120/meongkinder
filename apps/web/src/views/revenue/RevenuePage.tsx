import { PageShell } from "@/shared/ui";
import { RevenueBoard } from "@/widgets/revenue-board";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 매출 페이지 (view) — job-051.
 *
 * 매장 화면 안에 있다. 매출은 그 유치원의 것이고, 어느 매장의 매출인지는 URL 의
 * `[tenant]` 세그먼트가 정한다(job-038) — 플랫폼 콘솔(apps/admin)에는 개설권만 남는다.
 */
export const RevenuePage = () => (
  <PageShell
    title='매출'
    description='이용권 판매로 들어온 돈을 월별로 확인합니다.'
    width='md'
    nav={<MobileNav />}
    desktopSidebar
    desktopWide
  >
    <RevenueBoard />
  </PageShell>
);
