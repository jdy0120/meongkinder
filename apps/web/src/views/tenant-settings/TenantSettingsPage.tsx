import { PageShell } from "@/shared/ui";
import { TenantSettingsForm } from "@/features/tenant/update-settings";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 매장 설정 화면 (view, job-059).
 *
 * 원장이 자기 매장 정보를 고치는 유일한 자리. 이 화면이 생기기 전에는 매장 수정 API 가
 * SUPER_ADMIN 전용이라 원장이 주소를 넣을 방법이 없었고, 그래서 지도 기반 매장 찾기도
 * 성립하지 않았다.
 */
export const TenantSettingsPage = () => (
  <PageShell
    title='매장 설정'
    description='매장 이름·연락처·주소를 관리합니다. 주소를 등록하면 보호자가 지도에서 찾을 수 있습니다.'
    width='md'
    nav={<MobileNav />}
    desktopSidebar
  >
    <TenantSettingsForm />
  </PageShell>
);
