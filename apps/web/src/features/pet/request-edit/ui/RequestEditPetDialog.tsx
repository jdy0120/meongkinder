"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pencil } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from "@pawlog/ui";
import type { Pet } from "@pawlog/database";

import { PhoneInput } from "@/shared/ui";

import { useRequestEditPet } from "../model/useRequestEditPet";

interface FormValues {
  weightKg?: number;
  guardianPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  careNote: string;
}

/**
 * 아이 정보 수정 요청 다이얼로그 (feature ui). 견종/생년월일 등 등록 정보는 상담을 통해
 * 변경하도록 안내하고, 보호자가 직접 최신 상태로 유지해야 하는 연락처·체중·케어노트만 수정한다.
 */
export const RequestEditPetDialog = ({ pet }: { pet: Pet }) => {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, control } = useForm<FormValues>({
    defaultValues: {
      weightKg: pet.weightKg ?? undefined,
      guardianPhone: pet.guardianPhone ?? "",
      emergencyContactName: pet.emergencyContactName ?? "",
      emergencyContactPhone: pet.emergencyContactPhone ?? "",
      careNote: pet.careNote ?? "",
    },
  });
  const requestEdit = useRequestEditPet(() => setOpen(false));

  const onSubmit = (values: FormValues) =>
    requestEdit.mutate({
      id: pet.id,
      weightKg:
        values.weightKg === undefined || Number.isNaN(Number(values.weightKg))
          ? undefined
          : Number(values.weightKg),
      guardianPhone: values.guardianPhone || undefined,
      emergencyContactName: values.emergencyContactName || undefined,
      emergencyContactPhone: values.emergencyContactPhone || undefined,
      careNote: values.careNote || undefined,
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' className='gap-1.5'>
          <Pencil className='size-3.5' />
          정보 수정 요청
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{pet.name} 정보 수정 요청</DialogTitle>
          <p className='text-xs text-muted-foreground'>
            이름·견종·생년월일 등 등록 정보 변경은 담당 선생님께 문의해주세요.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4 pt-2'>
          <Field>
            <FieldLabel htmlFor='weightKg'>체중 (kg)</FieldLabel>
            <Input id='weightKg' type='number' step='0.1' {...register("weightKg", { valueAsNumber: true })} />
          </Field>

          <Field>
            <FieldLabel htmlFor='guardianPhone'>보호자 연락처</FieldLabel>
            <Controller
              control={control}
              name='guardianPhone'
              render={({ field }) => (
                <PhoneInput
                  id='guardianPhone'
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor='emergencyContactName'>비상 연락처 이름</FieldLabel>
            <Input id='emergencyContactName' {...register("emergencyContactName")} />
          </Field>

          <Field>
            <FieldLabel htmlFor='emergencyContactPhone'>비상 연락처 전화번호</FieldLabel>
            <Controller
              control={control}
              name='emergencyContactPhone'
              render={({ field }) => (
                <PhoneInput
                  id='emergencyContactPhone'
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor='careNote'>케어 노트 (알러지 · 투약 · 특이사항)</FieldLabel>
            <Textarea
              id='careNote'
              rows={4}
              {...register("careNote")}
              placeholder='예: 닭고기 알러지 있음. 아침저녁 관절 영양제 급여 중.'
            />
          </Field>

          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type='submit' disabled={requestEdit.isPending}>
              {requestEdit.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
