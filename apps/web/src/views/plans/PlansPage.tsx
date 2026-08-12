import { PageShell } from "@/shared/ui";
import { PlansManager } from "@/widgets/plans-manager";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 요금제 관리 페이지 (view) — job-051.
 * 헤더 + 위젯 조합만 담당한다 (FSD §7: view 는 데이터 페칭을 하지 않는다).
 */
export const PlansPage = () => (
  <PageShell
    title='요금제'
    description='우리 유치원이 파는 이용권을 만들고 관리합니다.'
    width='md'
    nav={<MobileNav />}
    desktopSidebar
    desktopWide
  >
    <PlansManager />
  </PageShell>
);
