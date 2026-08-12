import { PageShell } from "@/shared/ui";
import { MembersTable } from "@/widgets/members-table";
import { InvitationsTable } from "@/widgets/invitations-table";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 구성원 관리 페이지 (view) — 매장 관리자 전용.
 * `(tenantAuth)` 아래에 있어 활성 매장 소속이 없으면 도달할 수 없다.
 */
export const MembersPage = () => {
  return (
    <PageShell
      title='구성원 관리'
      description='보호자 가입 신청을 승인하고, 스태프·관리자 자격을 부여합니다. 아직 가입하지 않은 보호자는 연락처로 미리 초대해 둘 수 있습니다.'
      nav={<MobileNav />}
      desktopSidebar
      desktopWide
    >
      <MembersTable />
      <InvitationsTable />
    </PageShell>
  );
};
