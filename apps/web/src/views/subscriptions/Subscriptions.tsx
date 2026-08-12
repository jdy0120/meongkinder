import { PageShell } from "@/shared/ui";
import { SubscriptionsTable } from "@/widgets/subscriptions-table";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 이용권 관리 페이지 (view). 헤더 + 목록 위젯 조합만 담당한다.
 *
 * 매장 화면이므로 "이 매장에서 판매한 정기권" 기준이다 — 예전 문구는 플랫폼 콘솔의
 * 전체 요금제 모니터링 설명이 그대로 남아 있던 것이다.
 */
export const SubscriptionsPage = () => {
  return (
    <PageShell
      title='이용권 관리'
      description='이 매장의 정기권·회수권 판매 현황과 다음 정기 결제 일정을 확인합니다.'
      nav={<MobileNav />}
      desktopSidebar
      desktopWide
    >
      <SubscriptionsTable />
    </PageShell>
  );
};
