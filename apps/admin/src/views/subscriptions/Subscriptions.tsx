import { SubscriptionsTable } from "@/widgets/subscriptions-table";

/**
 * 구독 관리 페이지 (view). 헤더 + 목록 위젯 조합만 담당한다.
 */
export const SubscriptionsPage = () => {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          구독 관리
        </h1>
        <p className='text-slate-400 text-sm'>
          유저들의 현재 요금제 구독 현황 및 다음 정기 결제 일정을 모니터링합니다.
        </p>
      </div>

      <SubscriptionsTable />
    </div>
  );
};
