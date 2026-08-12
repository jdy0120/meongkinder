"use client";

import { CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@pawlog/ui";

import { useMySubscription, useMyTickets } from "@/entities/subscription";

import { TicketCard } from "./TicketCard";

/** 정기권 현황 요약 (widget) — 나의 구독 상태 + 정기권/회수권별 잔여 횟수·사용 내역을 자체 조회해 보여준다. */
export const SubscriptionSummary = () => {
  const { data: mySubscription, isLoading: isLoadingSubscription } = useMySubscription();
  const { data: tickets, isLoading: isLoadingTickets } = useMyTickets();

  if (isLoadingSubscription || isLoadingTickets) {
    return (
      <div className='flex justify-center py-8'>
        <Spinner className='size-6' />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <CreditCard className='size-4' />
            결제 수단
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mySubscription?.billingKey ? (
            <p className='text-sm'>
              {mySubscription.billingKey.cardName} {mySubscription.billingKey.cardNumber}
            </p>
          ) : (
            <p className='text-sm text-muted-foreground'>등록된 결제 수단이 없어요.</p>
          )}
        </CardContent>
      </Card>

      {tickets && tickets.length > 0 ? (
        tickets.map(({ subscription, remainingCount }) => (
          <TicketCard
            key={subscription.id}
            subscription={subscription}
            remainingCount={remainingCount}
          />
        ))
      ) : (
        <Card className='border-dashed'>
          <CardContent className='py-10 text-center text-sm text-muted-foreground'>
            이용 중인 정기권/회수권이 없어요.
          </CardContent>
        </Card>
      )}
    </div>
  );
};
