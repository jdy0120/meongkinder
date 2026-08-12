import { PageShell } from "@/shared/ui";
import { SubscriptionSummary } from "@/widgets/subscription-summary";
import { MyTickets } from "@/widgets/my-tickets";
import { MobileNav } from "@/widgets/mobile-nav";

/** 정기권 현황 화면 (view) — 구독/정기권 잔여·사용 내역 조회를 widget 에 위임해 조합한다. */
export const MySubscriptionsPage = () => (
  <PageShell title='정기권 현황' width='md' nav={<MobileNav />}>
    {/* job-046: 아이별 잔여 횟수 + 등원 이력. 예전엔 이 화면이 결제수단만 보여줘서
        "우리 애 몇 번 남았지"에 답하지 못했다. */}
    <MyTickets />
    <SubscriptionSummary />
  </PageShell>
);
