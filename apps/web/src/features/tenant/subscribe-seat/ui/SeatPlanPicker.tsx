"use client";

import { Button, Card, CardContent, Spinner } from "@pawlog/ui";

import { useSeatPlans, useSubscribeSeat } from "../model/useSeatSubscription";

/**
 * 매장 개설권 요금제 선택 (feature ui).
 * 개설권이 하나도 없을 때만 노출되며, 결제가 성사되면 미사용 개설권 1건이 발급된다.
 */
export const SeatPlanPicker = () => {
  const { data, isLoading } = useSeatPlans();
  const subscribe = useSubscribeSeat();

  const plans = data?.plans ?? [];
  // 서버가 결제 없이 발급하는 상태인지 (job-056). 기본값은 "결제 필요" 쪽이다 —
  // 응답을 못 읽었을 때 무료라고 말해버리면 안 된다.
  const paymentRequired = data?.paymentRequired ?? true;

  if (isLoading) {
    return (
      <div className='flex justify-center py-8'>
        <Spinner className='size-6 text-primary' />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <p className='py-6 text-center text-sm text-muted-foreground'>
        판매 중인 개설권 요금제가 없습니다. 플랫폼 관리자에게 문의하세요.
      </p>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      {/* 누르기 전에 밝힌다 — 카드도 등록하지 않았는데 "구독"이 성사되면
          사용자는 결제된 줄 안다. */}
      {!paymentRequired && (
        <p className='rounded-xl border border-dashed p-3 text-sm text-muted-foreground'>
          결제 연동 준비 중입니다. 지금은 <b>결제 없이</b> 개설권이 발급되며,
          표시된 금액은 청구되지 않습니다.
        </p>
      )}

      <div className='grid gap-3 sm:grid-cols-2'>
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardContent className='flex flex-col gap-3 p-4'>
              <div>
                <p className='font-semibold'>{plan.name}</p>
                <p className='text-sm text-muted-foreground'>
                  {plan.price.toLocaleString("ko-KR")}원 /{" "}
                  {plan.interval === "YEARLY" ? "년" : "월"}
                </p>
                {plan.description && (
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {plan.description}
                  </p>
                )}
              </div>
              <Button
                disabled={subscribe.isPending}
                onClick={() => subscribe.mutate(plan.id)}
                className='rounded-xl font-semibold'
              >
                {subscribe.isPending
                  ? paymentRequired
                    ? "결제 중…"
                    : "발급 중…"
                  : paymentRequired
                    ? "이 요금제로 구독"
                    : "이 요금제로 개설권 받기"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
