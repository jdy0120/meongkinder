import { Card, CardContent } from "@pawlog/ui";

import { DashboardStats } from "@/widgets/dashboard-stats";

/**
 * 대시보드 페이지 (view). 헤더 + 통계 위젯 + 환영 카드 조합만 담당한다.
 */
export const DashboardPage = () => {
  return (
    <div className='space-y-8'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          대시보드
        </h1>
        <p className='text-slate-400 text-sm'>
          현재 서비스의 주요 현황 지표를 한눈에 모니터링합니다.
        </p>
      </div>

      <DashboardStats />

      <Card className='border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/40 text-slate-100 backdrop-blur-sm'>
        <CardContent className='py-8 px-6 flex flex-col md:flex-row items-center justify-between gap-6'>
          <div className='space-y-2'>
            <h2 className='text-xl font-bold text-white'>
              어드민 템플릿에 오신 것을 환영합니다!
            </h2>
            <p className='text-sm text-slate-400 max-w-xl'>
              본 대시보드는 모노레포 아키텍처 상의 API와 실시간으로 연동되어
              있습니다. 좌측 메뉴에서 가입된 사용자의 권한을 변경하고 정기 구독
              내역을 즉시 확인할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
