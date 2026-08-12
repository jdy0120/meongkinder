import { PlatformSubscriptionsTable } from "@/widgets/platform-subscriptions-table";

/**
 * 전 플랫폼 구독 현황 페이지 (view).
 * 매장 개설권(SaaS 요금) 구독을 다룬다 — 보호자가 사는 원생 이용권과는 별개다.
 */
export const SubscriptionsPage = () => {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          구독 현황
        </h1>
        <p className='text-sm text-slate-400'>
          매장 개설권 구독 전체를 조회합니다. 매장이 연결되지 않은 건은 아직
          사용하지 않은 개설권입니다.
        </p>
      </div>

      <PlatformSubscriptionsTable />
    </div>
  );
};
