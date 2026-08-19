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
  NativeSelect,
  Spinner,
} from "@pawlog/ui";
import {
  SALE_METHODS,
  SALE_METHOD_LABELS,
  type SaleMethod,
} from "@pawlog/shared";

import { useSellablePlans, useSellTicket } from "../model/useSellTicket";

interface SellTicketDialogProps {
  petId: string;
  petName: string;
}

interface SellFormValues {
  planId: string;
  method: SaleMethod;
  /** 비워두면 요금제 정가. 빈 문자열과 0을 구분해야 해서 문자열로 받는다. */
  amount: string;
  memo: string;
}

/**
 * 이용권 판매 다이얼로그 (job-051).
 *
 * 원장이 대면으로 결제를 받고 이 자리에서 이용권을 개통한다. 요금제를 고르면 횟수·유효기간·
 * 금액이 따라오므로 입력할 것은 **결제수단** 하나다 — 데스크에서 보호자를 세워두고 쓰는
 * 화면이라 입력이 하나라도 더 늘면 안 쓰인다.
 *
 * 금액은 비워두면 정가로 잡힌다. 형제 할인처럼 다르게 받는 경우가 실제로 있고
 * **매출은 받은 돈 기준**이라, 정가를 강제로 기록하면 장부가 틀린다.
 */
export const SellTicketDialog = ({ petId, petName }: SellTicketDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // 다이얼로그를 열 때만 요금제를 부른다 — 원생 목록의 행마다 미리 부르면 같은 요청이
  // 화면당 수십 번 나간다.
  const { data: plans = [], isLoading } = useSellablePlans(isOpen);

  const { register, handleSubmit, reset, watch } = useForm<SellFormValues>({
    defaultValues: { planId: "", method: "CASH", amount: "", memo: "" },
  });

  const sellTicket = useSellTicket(() => {
    setIsOpen(false);
    reset();
  });

  const selectedPlan = plans.find((plan) => plan.id === watch("planId"));

  const onSubmit = (values: SellFormValues) => {
    sellTicket.mutate({
      petId,
      planId: values.planId,
      method: values.method,
      amount: values.amount.trim() === "" ? undefined : Number(values.amount),
      memo: values.memo.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {/* 원생 상세 시트 하단에서 '정보 수정'과 나란히 놓이므로 폭을 나눠 갖는다. */}
        <Button className='flex-1'>이용권 판매</Button>
      </DialogTrigger>

      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{petName} 이용권 판매</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className='flex justify-center py-5'>
            <Spinner />
          </div>
        ) : plans.length === 0 ? (
          <p className='break-keep py-4 text-sm text-muted-foreground'>
            판매 중인 요금제가 없습니다. 매장 홈 → 요금제에서 먼저 상품을
            등록해주세요.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
          >
            <div className='flex flex-col gap-2'>
              <Label htmlFor='planId'>요금제</Label>
              <NativeSelect
                id='planId'
                {...register("planId", { required: true })}
              >
                <option value=''>선택하세요</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {plan.price.toLocaleString()}원
                    {plan.totalCount ? ` · ${plan.totalCount}회` : ""}
                  </option>
                ))}
              </NativeSelect>
              {selectedPlan && (
                <p className='text-xs text-muted-foreground'>
                  유효기간 {selectedPlan.validityDays ?? 30}일
                  {selectedPlan.totalCount
                    ? ` · ${selectedPlan.totalCount}회 충전`
                    : " · 기간 내 무제한"}
                </p>
              )}
            </div>

            <div className='flex flex-col gap-2'>
              <Label htmlFor='method'>결제 수단</Label>
              <NativeSelect id='method' {...register("method")}>
                {SALE_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {SALE_METHOD_LABELS[method]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className='flex flex-col gap-2'>
              <Label htmlFor='amount'>
                실수령액 (선택)
              </Label>
              <Input
                id='amount'
                type='number'
                inputMode='numeric'
                placeholder={
                  selectedPlan
                    ? `비우면 정가 ${selectedPlan.price.toLocaleString()}원`
                    : "비우면 요금제 정가"
                }
                {...register("amount")}
              />
              <p className='text-xs text-muted-foreground'>
                할인해서 받았다면 실제로 받은 금액을 적어주세요. 매출은 이
                금액으로 잡힙니다.
              </p>
            </div>

            <div className='flex flex-col gap-2'>
              <Label htmlFor='memo'>메모 (선택)</Label>
              <Input
                id='memo'
                placeholder='예: 형제 할인'
                {...register("memo")}
              />
            </div>

            <DialogFooter>
              <Button type='submit' disabled={sellTicket.isPending}>
                판매하기
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
