import { TenantsTable } from "@/widgets/tenants-table";

/**
 * 테넌트 관리 페이지 (view) — SUPER_ADMIN 전용. 헤더 + 목록 위젯 조합만 담당한다.
 */
export const TenantsPage = () => {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          테넌트 관리
        </h1>
        <p className='text-slate-400 text-sm'>
          플랫폼에 입점한 가맹점(매장)의 현황을 확인하고, 매장 정보 수정 및
          운영 정지·재개를 처리할 수 있습니다.
        </p>
      </div>

      <TenantsTable />
    </div>
  );
};
