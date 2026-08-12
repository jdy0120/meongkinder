import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@pawlog/ui";

import { PageShell } from "@/shared/ui";
import { ApplyMembershipDialog } from "@/features/membership/apply-membership";
import { MyTenants } from "@/widgets/my-tenants";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 내 매장 페이지 (view). 헤더 + 소속 목록 위젯 조합만 담당한다.
 */
export const MyTenantsPage = () => {
  return (
    <PageShell
      title='내 매장'
      description='관리자·스태프로 일하는 매장으로 들어가고, 아이를 맡긴 매장의 승인 현황을 확인합니다.'
      width='md'
      action={<ApplyMembershipDialog />}
      nav={<MobileNav />}
    >
      <MyTenants />

      {/* 매장 개설(/onboarding)로 들어가는 유일한 입구. 이 링크가 없어서 지금까지는
          주소를 직접 입력하지 않으면 매장을 열 수 없었다. */}
      <Button asChild variant='outline' className='w-full gap-1.5'>
        <Link href='/onboarding'>
          <Plus className='size-4' />
          내 매장 열기
        </Link>
      </Button>
    </PageShell>
  );
};
