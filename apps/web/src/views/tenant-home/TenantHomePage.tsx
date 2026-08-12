"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Camera, ClipboardCheck, NotebookPen } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pawlog/ui";
import { PageShell, QuickActionBar, SectionHeading } from "@/shared/ui";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { visibleTenantMenu } from "@/shared/libs/tenant/menu";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";
import { TenantSwitcher } from "@/features/tenant/switch-tenant";
import { MobileNav } from "@/widgets/mobile-nav";
import { PhotoGapAlert } from "@/widgets/photo-gap-alert";
import { TodayBoard } from "@/widgets/today-board";

/**
 * 매장 홈 (view) — `/tenant/[tenant]` 진입점.
 *
 * job-052: **메뉴판이 아니라 오늘이다** (design-system.md §6.2).
 *
 * 예전에는 관리 메뉴 카드 7~10장이 화면을 채웠다. 그러면 원장은 매일 아침 "무엇이 급한가"를
 * 스스로 판단해 메뉴를 골라야 하는데, 그 판단이야말로 이 화면이 대신해 줘야 하는 일이다.
 * 이제 위에서부터 **지금 안 보면 되돌릴 수 없는 순서**로 오늘 상황이 나오고, 관리 메뉴는
 * 그 아래 섹션으로 내려간다.
 *
 * 하단에는 퀵액션 3개를 고정한다 — 상황을 읽은 직후에 바로 실행할 수 있어야 하는데,
 * 실행 버튼이 스크롤 안에 있으면 정보를 읽고 다시 찾아 내려가야 한다.
 *
 * GUARDIAN 은 운영 메뉴가 하나도 없으므로 여기서 개인 화면으로 안내한다 — 게이트는
 * "이 매장을 쓸 수 있는가"만 보고 통과시키기 때문에 보호자도 이 페이지까지는 들어온다.
 */
export const TenantHomePage = () => {
  const { tenant } = useParams<{ tenant: string }>();
  const currentRole = useTenantStore((state) => state.currentRole);
  const memberships = useTenantStore((state) => state.memberships);
  const isPlatformAdmin = useTenantStore((state) => state.isPlatformAdmin);
  const currentTenantName = useTenantStore((state) => state.currentTenantName);

  const current = memberships.find((m) => m.tenant.subdomain === tenant);
  // job-050: SUPER_ADMIN 은 소속이 없어 currentRole 이 null 이지만, 서버는 매장 API 를
  // 전부 열어준다(컨트롤러들이 @Roles 에 SUPER_ADMIN 을 명시 나열한다). 소속 역할로
  // 걸러버리면 들어와도 메뉴가 하나도 없는 빈 화면이 된다.
  const visible = visibleTenantMenu(currentRole, isPlatformAdmin);

  const isGuardianOnly = visible.length === 0;

  return (
    <PageShell
      title={current?.tenant.name ?? currentTenantName ?? tenant}
      width='md'
      nav={<MobileNav />}
      desktopSidebar
      desktopWide
      quickActions={
        isGuardianOnly ? undefined : (
          <QuickActionBar>
            {/* 최대 3개. 그 이상이면 위계가 없다는 뜻이므로 아래 관리 메뉴로 내린다. */}
            <Button asChild size='lg'>
              <Link href={tenantPath(tenant, "attendance")}>
                <ClipboardCheck />
                등원 처리
              </Link>
            </Button>
            <Button asChild variant='outline' size='lg'>
              <Link href={tenantPath(tenant, "daily-reports")}>
                <NotebookPen />
                알림장
              </Link>
            </Button>
            <Button asChild variant='outline' size='lg'>
              <Link href={tenantPath(tenant, "feed/new")}>
                <Camera />
                사진
              </Link>
            </Button>
          </QuickActionBar>
        )
      }
    >
      <TenantSwitcher />

      {isGuardianOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>보호자로 소속된 매장입니다</CardTitle>
            <CardDescription>
              이 매장의 운영 권한은 없습니다. 아이의 리포트와 정기권은 개인
              화면에서 확인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-3'>
            <Button asChild>
              <Link href='/reports'>리포트 보기</Link>
            </Button>
            <Button asChild variant='outline'>
              <Link href='/app'>홈으로</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 사진 0장 경고가 대시보드보다 위인 이유: 오늘 사진은 시간이 지나면
              되돌릴 수 없는 유일한 항목이다(job-048). */}
          <PhotoGapAlert />

          <TodayBoard />

          <section className='space-y-3'>
            <SectionHeading>매장 관리</SectionHeading>
            <div className='grid gap-3 sm:grid-cols-2'>
              {visible.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    href={tenantPath(tenant, link.path)}
                    className='block'
                  >
                    <Card className='h-full transition-colors hover:border-primary/30 hover:bg-accent'>
                      <CardHeader className='flex-row items-center gap-3 space-y-0'>
                        <span className='rounded-xl bg-primary-tint p-2 text-primary-on-tint'>
                          <Icon className='size-5' />
                        </span>
                        <div className='min-w-0'>
                          <CardTitle className='text-body'>
                            {link.label}
                          </CardTitle>
                          <CardDescription className='text-label'>
                            {link.description}
                          </CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
};
