"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@pawlog/ui";
import type { RevenueSaleItem } from "@pawlog/shared";

import { useRefundSale } from "../model/useRefundSale";

interface RefundSaleDialogProps {
  sale: RevenueSaleItem;
}

interface RefundFormValues {
  /** 비우면 남은 전액. 빈 문자열과 0을 구분해야 해서 문자열로 받는다. */
  amount: string;
  reason: string;
}

const won = (n: number) => `${n.toLocaleString()}원`;

/**
 * 환불 다이얼로그 (job-054).
 *
 * 금액을 비우면 **남은 전액**이 기본이다 — 대부분의 환불은 전액이고, 부분 환불은
 * "10회권 사서 3회 쓰고 그만둠" 같은 경우에만 쓴다.
 *
 * 전액 환불일 때만 이용권이 회수된다는 걸 화면에 적는다. 부분 환불하면 아이가 계속
 * 다닐 수 있는데, 그걸 모르면 원장이 "환불했는데 왜 아직 다니지"로 읽는다.
 */
export const RefundSaleDialog = ({ sale }: RefundSaleDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const refundable = sale.amount - sale.refundedAmount;

  const { register, handleSubmit, reset, watch } = useForm<RefundFormValues>({
    defaultValues: { amount: "", reason: "" },
  });

  const refund = useRefundSale(() => {
    setIsOpen(false);
    reset();
  });

  const entered = watch("amount").trim();
  const willRefund = entered === "" ? refundable : Number(entered);
  const isFull = willRefund >= refundable;

  const onSubmit = (values: RefundFormValues) => {
    refund.mutate({
      saleId: sale.id,
      amount: values.amount.trim() === "" ? undefined : Number(values.amount),
      reason: values.reason.trim() || undefined,
    });
  };

  // 이미 전액 환불된 건은 더 할 게 없다.
  if (refundable <= 0) {
    return <span className='text-xs text-muted-foreground'>환불 완료</span>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost'>
          환불
        </Button>
      </DialogTrigger>

      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {sale.petName ?? "원생"} · {sale.planName ?? "이용권"} 환불
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
          <div className='rounded-xl bg-muted px-4 py-3 text-sm'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>판매 금액</span>
              <span>{won(sale.amount)}</span>
            </div>
            {sale.refundedAmount > 0 && (
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>기환불</span>
                <span>{won(sale.refundedAmount)}</span>
              </div>
            )}
            <div className='mt-1 flex justify-between font-medium'>
              <span>환불 가능</span>
              <span>{won(refundable)}</span>
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='amount'>환불 금액 (선택)</Label>
            <Input
              id='amount'
              type='number'
              inputMode='numeric'
              placeholder={`비우면 전액 ${won(refundable)}`}
              {...register("amount")}
            />
            <p className='break-keep text-xs text-muted-foreground'>
              {isFull ? (
                <>
                  <b>전액 환불</b>이라 남은 이용권 횟수를 함께 회수합니다. 이미
                  사용한 횟수는 회수하지 않습니다.
                </>
              ) : (
                <>
                  <b>부분 환불</b>이라 이용권은 그대로 둡니다. 아이가 남은
                  횟수로 계속 등원할 수 있습니다.
                </>
              )}
            </p>
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='reason'>사유 (선택)</Label>
            <Input
              id='reason'
              placeholder='예: 이사로 퇴원'
              {...register("reason")}
            />
          </div>

          <DialogFooter>
            <Button
              type='submit'
              variant='destructive'
              disabled={refund.isPending}
            >
              환불 처리
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
