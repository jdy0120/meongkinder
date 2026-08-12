import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { Button, Card, CardContent } from "@pawlog/ui";
import { ROLES } from "@pawlog/shared";
import type { MembershipWithTenant } from "@pawlog/shared";

import { PageShell } from "@/shared/ui";
import { tenantPath } from "@/shared/libs/tenant/routes";

const ROLE_LABEL: Record<string, string> = {
  [ROLES.TENANT_ADMIN]: "원장",
  [ROLES.STAFF]: "선생님",
};

/**
 * 매장 고르기 (view) — 운영 중인 매장이 둘 이상일 때의 로그인 착지 화면 (job-042).
 *
 * 매장이 하나면 이 화면을 거치지 않고 곧장 그 매장으로 간다. 여기까지 온 사람은 실제로
 * 두 곳 이상을 운영하고 있으므로, 고르는 것 외의 요소는 두지 않는다 — 이 화면의 목적은
 * 한 번의 탭으로 일하러 들어가는 것이다.
 *
 * 서버 컴포넌트다. 소속 목록은 상위 page 가 SSR `mypage` 응답에서 이미 걸러 넘겨준다.
 */
export const LaunchPage = ({
  memberships,
}: {
  memberships: MembershipWithTenant[];
}) => (
  <PageShell
    title='매장 선택'
    description='들어갈 매장을 선택하세요.'
    width='sm'
  >
    <div className='space-y-2'>
      {memberships.map((membership) => (
        <Link
          key={membership.id}
          href={tenantPath(membership.tenant.subdomain)}
          className='block'
        >
          <Card className='transition hover:bg-muted/60'>
            <CardContent className='flex items-center gap-3 py-4'>
              <Store className='size-5 shrink-0 text-muted-foreground' />
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium'>{membership.tenant.name}</p>
                <p className='text-xs text-muted-foreground'>
                  {ROLE_LABEL[membership.role] ?? membership.role} ·{" "}
                  {membership.tenant.subdomain}
                </p>
              </div>
              <ChevronRight className='size-4 shrink-0 text-muted-foreground' />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>

    <div className='pt-2 text-center'>
      <Button asChild variant='ghost'>
        <Link href='/app'>개인 화면으로 가기</Link>
      </Button>
    </div>
  </PageShell>
);
