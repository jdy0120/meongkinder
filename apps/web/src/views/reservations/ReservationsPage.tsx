import { PageShell } from "@/shared/ui";
import { ReservationBoard } from "@/widgets/reservation-board";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 등원 예약 화면 (view, job-060).
 *
 * 보호자가 유치원 운영일 중에서 아이가 갈 날을 직접 고른다. 이 화면이 생기기 전에는
 * 등원일을 정하는 경로가 원장의 스케줄 편집 하나뿐이라, 보호자는 "다음 주 화요일에
 * 보낼게요"를 단톡방으로 말하고 원장이 그걸 옮겨 적어야 했다.
 */
export const ReservationsPage = () => (
  <PageShell
    title='등원 예약'
    description='유치원이 문을 여는 날 중에서 아이가 갈 날을 고릅니다. 이용권은 실제 등원한 날에 차감됩니다.'
    width='md'
    nav={<MobileNav />}
    desktopSidebar
  >
    <ReservationBoard />
  </PageShell>
);
