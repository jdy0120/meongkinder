"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pawlog/ui";
import { Ticket } from "lucide-react";
import type { SubscriptionPlan } from "@pawlog/database";
import {
  SUBSCRIPTION_PLAN_TYPES,
  type SubscriptionPlanType,
} from "@pawlog/shared";

import { EmptyState, SectionHeading } from "@/shared/ui";
import { usePaginatedList } from "@/shared/libs/query/usePaginatedList";
import {
  useCreatePlan,
  useDeletePlan,
  useUpdatePlan,
} from "@/features/plan/manage-plan";

const PLAN_TYPE_LABELS: Record<SubscriptionPlanType, string> = {
  COUNT: "회수권",
  UNLIMITED: "기간 무제한",
  PERIOD: "단기 기간권",
  RECURRING: "정기결제",
};

/**
 * 이 유형은 횟수 개념이 있는가. `totalCount` 입력 노출 여부를 정한다.
 * 서버의 `assertPlanShapeValid` 와 같은 기준이라 한쪽만 바꾸면 400 이 난다.
 */
const hasCount = (planType: SubscriptionPlanType) =>
  planType === "COUNT" || planType === "PERIOD";

interface PlanFormValues {
  name: string;
  price: number;
  planType: SubscriptionPlanType;
  totalCount?: number;
  validityDays?: number;
  description?: string;
}

/**
 * 요금제 관리 위젯 (job-051).
 *
 * **이 유치원이 파는 이용권**의 목록과 CRUD 를 소유한다. 예전에는 요금제에 주인이 없어
 * 한 유치원이 만든 상품이 전체에 노출됐고, 만들 화면 자체가 없어서 API 만 떠 있었다.
 *
 * 원장이 pawlog 에 내는 **매장 개설권은 여기 없다** — 그건 플랫폼 상품이라 이 화면의
 * 목록(`v1/subscriptions/plans/all`)에 잡히지 않는다.
 */
export const PlansManager = () => {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = usePaginatedList<SubscriptionPlan>(
    "tenant-plans",
    "/v1/subscriptions/plans/all",
    { page, pageSize: 20, sort: "createdAt", order: "desc" },
  );

  const close = () => {
    setIsOpen(false);
    setEditing(null);
  };

  const createPlan = useCreatePlan(close);
  const updatePlan = useUpdatePlan(close);
  const deletePlan = useDeletePlan();

  const { register, handleSubmit, watch, reset } = useForm<PlanFormValues>({
    defaultValues: { planType: "COUNT", price: 0, name: "" },
  });
  const planType = watch("planType");

  const openCreate = () => {
    reset({ planType: "COUNT", price: 0, name: "" });
    setEditing(null);
    setIsOpen(true);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    reset({
      name: plan.name,
      price: plan.price,
      planType: plan.planType as SubscriptionPlanType,
      totalCount: plan.totalCount ?? undefined,
      validityDays: plan.validityDays ?? undefined,
      description: plan.description ?? undefined,
    });
    setEditing(plan);
    setIsOpen(true);
  };

  const onSubmit = (values: PlanFormValues) => {
    const payload = {
      ...values,
      // 유형이 바뀌면 맞지 않는 값은 보내지 않는다 — 서버가 조합을 검증해 400 을 준다.
      totalCount: hasCount(values.planType) ? values.totalCount : undefined,
      // RECURRING 외에는 유효기간이 필수다. interval 은 정기결제에서만 쓰이지만
      // 계약상 필수라 기본값을 채워 보낸다.
      interval: "MONTHLY",
    };

    if (editing) {
      updatePlan.mutate({ id: editing.id, ...payload });
      return;
    }
    createPlan.mutate(payload);
  };

  const plans = data?.items ?? [];

  return (
    <div className='flex flex-col gap-4'>
      <SectionHeading
        action={
          <Button onClick={openCreate}>
            요금제 추가
          </Button>
        }
      >
        우리 유치원이 파는 이용권
      </SectionHeading>

      {isLoading ? (
        <div className='flex justify-center py-10'>
          <Spinner />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title='등록된 요금제가 없어요'
          description='10회권, 월 무제한처럼 실제로 파는 상품을 등록하면 현장에서 바로 판매할 수 있습니다.'
          action={<Button onClick={openCreate}>첫 요금제 만들기</Button>}
        />
      ) : (
        <Card>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead className='text-right'>가격</TableHead>
                  <TableHead className='text-right'>횟수</TableHead>
                  <TableHead className='text-right'>유효기간</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className='font-medium'>{plan.name}</TableCell>
                    <TableCell>
                      {PLAN_TYPE_LABELS[
                        plan.planType as SubscriptionPlanType
                      ] ?? plan.planType}
                    </TableCell>
                    <TableCell className='text-right'>
                      {plan.price.toLocaleString()}원
                    </TableCell>
                    <TableCell className='text-right'>
                      {plan.totalCount ? `${plan.totalCount}회` : "-"}
                    </TableCell>
                    <TableCell className='text-right'>
                      {plan.validityDays ? `${plan.validityDays}일` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? "판매 중" : "판매 중지"}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          variant='outline'
                         
                          onClick={() => openEdit(plan)}
                        >
                          수정
                        </Button>
                        {plan.isActive && (
                          <Button
                            variant='ghost'
                           
                            onClick={() => deletePlan.mutate(plan.id)}
                            disabled={deletePlan.isPending}
                          >
                            판매 중지
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(data?.meta.totalPages ?? 0) > 1 && (
        <div className='flex justify-center gap-2'>
          <Button
            variant='outline'
           
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </Button>
          <Button
            variant='outline'
           
            disabled={page >= (data?.meta.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {editing ? "요금제 수정" : "요금제 추가"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
          >
            <div className='flex flex-col gap-2'>
              <Label htmlFor='name'>이름</Label>
              <Input
                id='name'
                placeholder='예: 10회권'
                {...register("name", { required: true })}
              />
            </div>

            <div className='flex flex-col gap-2'>
              <Label htmlFor='planType'>유형</Label>
              <NativeSelect id='planType' {...register("planType")}>
                {SUBSCRIPTION_PLAN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PLAN_TYPE_LABELS[type]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className='flex flex-col gap-2'>
              <Label htmlFor='price'>가격 (원)</Label>
              <Input
                id='price'
                type='number'
                {...register("price", { required: true, valueAsNumber: true })}
              />
            </div>

            {hasCount(planType) && (
              <div className='flex flex-col gap-2'>
                <Label htmlFor='totalCount'>제공 횟수</Label>
                <Input
                  id='totalCount'
                  type='number'
                  placeholder='예: 10'
                  {...register("totalCount", { valueAsNumber: true })}
                />
              </div>
            )}

            {planType !== "RECURRING" && (
              <div className='flex flex-col gap-2'>
                <Label htmlFor='validityDays'>유효기간 (일)</Label>
                <Input
                  id='validityDays'
                  type='number'
                  placeholder='예: 90'
                  {...register("validityDays", { valueAsNumber: true })}
                />
              </div>
            )}

            <div className='flex flex-col gap-2'>
              <Label htmlFor='description'>설명 (선택)</Label>
              <Input id='description' {...register("description")} />
            </div>

            <DialogFooter>
              <Button
                type='submit'
                disabled={createPlan.isPending || updatePlan.isPending}
              >
                {editing ? "수정" : "등록"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
