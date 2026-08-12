import { PageShell } from "@/shared/ui";
import { AttendanceTable } from "@/widgets/attendance-table";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 오늘의 출석부 페이지 (view). 헤더 + 목록 위젯 조합만 담당한다.
 */
export const AttendancePage = () => {
  return (
    <PageShell
      title='오늘의 출석부'
      description='오늘 등원 예정인 원생 목록을 확인하고 등원/하원 체크, 결석·보강 처리를 진행합니다.'
      nav={<MobileNav />}
      desktopSidebar
      desktopWide
    >
      <AttendanceTable />
    </PageShell>
  );
};
