"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Ticket } from "lucide-react";
import type { MyTicketSubscription } from "@pawlog/shared";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@pawlog/ui";

import {
  planTypeLabelMap,
  SubscriptionStatusBadge,
} from "@/entities/subscription";

import { UsageHistorySection } from "./UsageHistorySection";

/** 정기권/회수권 티켓 카드 (subscription-summary widget 내부 전용) — 펼치면 사용 내역을 조회해 보여준다. */
export const TicketCard = ({
  subscription,
  remainingCount,
}: {
  subscription: MyTicketSubscription;
  remainingCount: number | null;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className='flex-row items-center justify-between space-y-0'>
        <CardTitle className='flex flex-col gap-0.5 text-base'>
          {/* 이용권의 주인은 아이다(job-051). 형제견을 맡긴 보호자에게 요금제명만
              보여주면 "10회권 · 잔여 3회" 카드 두 장 중 어느 쪽이 충전이 필요한지
              알 수 없다. job-051 이전에 팔린 이용권은 아이를 가리키지 않는다. */}
          {subscription.pet && (
            <span className='text-sm text-muted-foreground'>
              {subscription.pet.name}
            </span>
          )}
          <span className='flex items-center gap-2'>
            <Ticket className='size-4' />
            {subscription.plan.name}
          </span>
        </CardTitle>
        {/* job-052: 상태 배지를 여기서 따로 칠하지 않고 entity 것을 쓴다 — 같은 상태가
            화면마다 다른 색이면 색이 뜻을 잃는다 (design-system.md §3.1). */}
        <SubscriptionStatusBadge status={subscription.status} />
      </CardHeader>
      <CardContent className='flex flex-col gap-1.5 text-sm text-muted-foreground'>
        <p>유형: {planTypeLabelMap[subscription.plan.planType] ?? subscription.plan.planType}</p>
        {remainingCount !== null && (
          <p className='text-base font-semibold text-foreground'>잔여 {remainingCount}회</p>
        )}
        <p>
          이용 기간: {new Date(subscription.startDate).toLocaleDateString("ko-KR")} ~{" "}
          {new Date(subscription.endDate).toLocaleDateString("ko-KR")}
        </p>
        {subscription.plan.planType === "RECURRING" && (
          <p>다음 결제일: {new Date(subscription.nextPaymentDate).toLocaleDateString("ko-KR")}</p>
        )}

        <Button
          variant='ghost'
         
          className='mt-2 w-fit self-end'
          onClick={() => setExpanded((prev) => !prev)}
        >
          사용 내역 {expanded ? "접기" : "보기"}
          {expanded ? <ChevronUp className='size-4' /> : <ChevronDown className='size-4' />}
        </Button>

        {expanded && (
          <div className='mt-1 border-t pt-3'>
            <UsageHistorySection subscriptionId={subscription.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
