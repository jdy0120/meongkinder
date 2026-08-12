"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from "@pawlog/ui";

import { PageShell } from "@/shared/ui";
import { OnboardingForm } from "@/features/tenant/onboard-tenant";
import { SeatPlanPicker, useMySeats } from "@/features/tenant/subscribe-seat";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 매장 개설 페이지 (view) — job-036.
 *
 * 인증 영역(`(checkauth)`) 안에 있다. 매장 개설은 플랫폼 고객의 행위이지만 **인증과
 * 개설권 구독이 모두 선행되어야** 하므로 공개 페이지일 수 없다 — 예전엔 `auth/` 아래
 * 공개 라우트라 비로그인 사용자가 폼을 제출하고 401 을 받았다.
 *
 * 미사용 개설권 보유 여부로 화면이 갈린다:
 *   없음 → 요금제 결제 먼저
 *   있음 → 매장 정보 입력 폼
 */
export const OnboardingPage = () => {
  const { data: seats, isLoading } = useMySeats();

  const unusedSeats = (seats ?? []).filter(
    (s) => s.tenantId === null && s.status === "ACTIVE",
  );
  const openedStores = (seats ?? []).filter((s) => s.tenantId !== null);

  return (
    <PageShell
      title='매장 개설'
      description='개설권 구독 1건당 매장 1개를 열 수 있습니다. 개설한 계정이 그대로 해당 매장의 관리자가 됩니다.'
      backHref='/tenants'
      width='md'
      nav={<MobileNav />}
    >
      {isLoading ? (
        <div className='flex justify-center py-12'>
          <Spinner className='h-8 w-8 text-primary' />
        </div>
      ) : unusedSeats.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>매장 정보</CardTitle>
            <CardDescription className='text-muted-foreground'>
              사용 가능한 개설권 {unusedSeats.length}건이 있습니다. 매장을
              개설하면 1건이 사용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>
              개설권 구독이 필요합니다
            </CardTitle>
            <CardDescription className='text-muted-foreground'>
              {openedStores.length > 0
                ? "보유한 개설권을 모두 사용했습니다. 매장을 추가로 열려면 구독을 하나 더 결제하세요."
                : "매장을 열려면 먼저 개설권을 결제해야 합니다."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeatPlanPicker />
          </CardContent>
        </Card>
      )}

      {openedStores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              개설한 매장 ({openedStores.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {openedStores.map((seat) => (
              <div
                key={seat.id}
                className='flex items-center justify-between rounded-xl border p-3'
              >
                <div className='min-w-0'>
                  <p className='truncate font-medium'>
                    {seat.tenant?.name ?? "—"}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {seat.tenant?.subdomain}
                  </p>
                </div>
                <span className='text-xs text-muted-foreground'>{seat.plan.name}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
};
