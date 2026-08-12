import { PageShell } from "@/shared/ui";
import { NotificationLogTable } from "@/widgets/notification-log-table";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 알림 발송 이력 화면 (view, job-046).
 * 알림톡이 이 제품의 전달 경로 전체라, 실패를 원장이 볼 수 있어야 한다.
 */
export const NotificationLogsPage = () => (
  <PageShell
    title='알림 발송 이력'
    description='보호자에게 나간 알림톡·문자의 발송 결과입니다.'
    width='md'
    nav={<MobileNav />}
    desktopSidebar
    desktopWide
  >
    <NotificationLogTable />
  </PageShell>
);
