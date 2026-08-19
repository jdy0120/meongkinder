"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CalendarX } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@pawlog/ui";

import { ATTENDANCE_STATUS_UPDATE_OPTIONS } from "@/entities/attendance";

import { useUpdateAttendanceStatus } from "../model/useUpdateAttendanceStatus";

interface FormValues {
  status: string;
  reason: string;
  deductSubscription: boolean;
}

const DEFAULT_VALUES: FormValues = {
  status: "ABSENT",
  reason: "",
  deductSubscription: false,
};

/** 결석/보강/취소 처리 다이얼로그 (feature ui) */
export const UpdateStatusDialog = ({
  attendanceId,
}: {
  attendanceId: string;
}) => {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, control, reset } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const updateStatus = useUpdateAttendanceStatus(() => {
    reset(DEFAULT_VALUES);
    setOpen(false);
  });

  const onSubmit = (values: FormValues) =>
    updateStatus.mutate({
      id: attendanceId,
      status: values.status,
      reason: values.reason || undefined,
      deductSubscription: values.deductSubscription,
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        if (!next) reset(DEFAULT_VALUES);
      }}
    >
      <DialogTrigger asChild>
        <Button
         
          variant='outline'
          className='rounded-xl h-8 px-3 text-xs gap-1.5'
        >
          <CalendarX className='w-3.5 h-3.5' />
          결석/보강
        </Button>
      </DialogTrigger>
      <DialogContent className='rounded-2xl sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='text-lg font-bold'>
            결석/보강/취소 처리
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 pt-2'>
          <div className='space-y-2'>
            <Label htmlFor='attendance-status' className='text-sm font-semibold'>
              상태
            </Label>
            <Controller
              name='status'
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id='attendance-status'
                    className='w-full rounded-xl'
                  >
                    <SelectValue placeholder='상태 선택' />
                  </SelectTrigger>
                  <SelectContent className='rounded-xl'>
                    {ATTENDANCE_STATUS_UPDATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='attendance-reason' className='text-sm font-semibold'>
              사유
            </Label>
            <Textarea
              id='attendance-reason'
              rows={3}
              {...register("reason")}
              placeholder='예: 컨디션 난조로 결석, 다음 주 화요일 보강 예정'
              className='rounded-xl'
            />
          </div>

          <div className='flex items-center justify-between py-2 border-y'>
            {/* 스위치는 글자를 안 들고 있다 — `<span>` 으로 두면 이름 없는 컨트롤이 된다.
                돈을 움직이는 토글이라 더더욱 무엇에 대한 스위치인지 읽혀야 한다. */}
            <Label
              htmlFor='attendance-deduct-subscription'
              className='text-sm font-semibold'
            >
              정기권/회수권 차감
            </Label>
            <Controller
              name='deductSubscription'
              control={control}
              render={({ field }) => (
                <Switch
                  id='attendance-deduct-subscription'
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className='flex justify-end gap-2 pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
              className='rounded-xl'
            >
              취소
            </Button>
            <Button
              type='submit'
              disabled={updateStatus.isPending}
              className='rounded-xl font-semibold'
            >
              {updateStatus.isPending ? "처리 중…" : "처리"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
