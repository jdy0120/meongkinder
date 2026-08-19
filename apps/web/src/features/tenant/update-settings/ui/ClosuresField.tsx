"use client";

import { useState } from "react";
import { CalendarOff } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Spinner } from "@pawlog/ui";
import { fromDateKey } from "@pawlog/shared";

import { DatePicker, EmptyState, SectionHeading } from "@/shared/ui";
import {
  useCreateClosure,
  useDeleteClosure,
  useTenantClosures,
} from "../model/useTenantClosures";

/** `Date` → `"YYYY-MM-DD (요일)"`. 요일이 붙어야 원장이 잘못 고른 날을 알아챈다. */
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const formatDate = (key: string) =>
  `${key} (${WEEKDAYS[fromDateKey(key).getDay()]})`;

/**
 * 임시 휴무일 (job-060) — 매장이 **특정 날짜 하루**를 쉰다.
 *
 * 요일 시간표(`BusinessHoursField`)가 "평소"라면 이 카드는 그 예외다. 명절·워크샵·소독·
 * 원장 사정처럼 요일 패턴으로는 표현할 수 없는 하루가 실제로 있고, 등원 예약이 생긴
 * 뒤로는 이걸 표현하지 못하면 **매장이 쉬는 날에 보호자가 예약을 잡는다.**
 *
 * ⚠️ 사유 칸이 선택인데도 눈에 띄게 둔 이유: 보호자 달력에 그대로 보인다. 사유 없이
 * 잠긴 날은 보호자에게 전부 똑같아 보여서 결국 매장에 전화하게 되는데, "설 연휴"라고
 * 적혀 있으면 그 전화가 없다.
 */
export const ClosuresField = () => {
  const { data: closures, isLoading } = useTenantClosures();
  const create = useCreateClosure();
  const remove = useDeleteClosure();

  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!date) return;
    create.mutate(
      { date, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setDate("");
          setReason("");
        },
      },
    );
  };

  return (
    <Card>
      <CardContent className='flex flex-col gap-6 pt-6'>
        <div className='flex flex-col gap-1'>
          <SectionHeading>임시 휴무일</SectionHeading>
          <p className='break-keep text-label text-muted-foreground'>
            명절·워크샵처럼 특정 날짜만 쉬는 경우에 등록합니다. 등록한 날은 보호자의
            등원 예약 달력에서 잠기고, 이미 잡혀 있던 예약은 취소되며 그 날 등원
            예정이던 보호자에게 안내가 발송됩니다.
          </p>
        </div>

        <div className='flex flex-col gap-3'>
          {/* 두 칸 모두 placeholder 만으로 이름을 삼고 있었다. 날짜를 고르는 순간
              "쉬는 날 선택"이 사라져, 옆의 사유 칸과 구분이 없어진다. */}
          <Label htmlFor='closure-date' className='sr-only'>
            쉬는 날
          </Label>
          <DatePicker
            id='closure-date'
            value={date}
            onChange={setDate}
            placeholder='쉬는 날 선택'
            /* 지난 날짜는 휴무로 지정할 뜻이 없다 — 서버도 400 으로 막는다. */
            disabled={{ before: new Date() }}
            clearable
          />
          <Label htmlFor='closure-reason' className='sr-only'>
            휴무 사유
          </Label>
          <Input
            id='closure-reason'
            value={reason}
            maxLength={100}
            placeholder='사유 (예: 설 연휴) — 보호자에게 보입니다'
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            type='button'
            variant='outline'
            onClick={submit}
            disabled={!date || create.isPending}
          >
            {create.isPending ? <Spinner className='size-5' /> : null}
            휴무일 등록
          </Button>
        </div>

        {isLoading ? (
          <div className='flex justify-center py-6'>
            <Spinner className='size-6 text-primary' />
          </div>
        ) : closures && closures.length > 0 ? (
          <div className='flex flex-col gap-2'>
            {closures.map((closure) => (
              <div
                key={closure.id}
                className='flex items-center justify-between gap-3 rounded-btn border p-4'
              >
                <div className='flex min-w-0 flex-col gap-1'>
                  <span className='font-semibold'>
                    {formatDate(closure.date)}
                  </span>
                  <span className='truncate text-label text-muted-foreground'>
                    {closure.reason ?? "사유 없음"}
                  </span>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  onClick={() => remove.mutate(closure.date)}
                  disabled={remove.isPending}
                >
                  해제
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarOff}
            title='등록된 임시 휴무일이 없어요'
            description='앞으로 쉬는 날이 정해지면 미리 등록해두세요. 보호자가 그 날을 예약하지 못하게 됩니다.'
          />
        )}
      </CardContent>
    </Card>
  );
};
