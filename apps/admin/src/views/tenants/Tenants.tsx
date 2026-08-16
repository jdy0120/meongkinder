import { TenantsTable } from "@/widgets/tenants-table";
import { PageHeader } from "@/shared/ui";

/**
 * 테넌트 관리 페이지 (view) — SUPER_ADMIN 전용. 헤더 + 목록 위젯 조합만 담당한다.
 */
export const TenantsPage = () => {
  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='테넌트 관리'
        description='플랫폼에 입점한 가맹점(매장)의 현황을 확인하고, 매장 정보 수정 및 운영 정지·재개를 처리할 수 있습니다.'
      />
      <TenantsTable />
    </div>
  );
};
