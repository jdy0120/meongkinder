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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pawlog/ui";

import { useUpdateUser } from "../model/useUpdateUser";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "활성" },
  { value: "PENDING", label: "대기" },
  { value: "SUSPENDED", label: "정지" },
];

interface FormValues {
  nickname: string;
  status: string;
}

interface EditUserDialogProps {
  user: { id: string; nickname: string; status: string };
}

/**
 * 사용자 정보 수정 다이얼로그 (feature ui). 닉네임·계정 상태를 수정한다.
 * 폼은 react-hook-form(Select 는 Controller)으로 다루고 제출은 뮤테이션에 위임한다.
 */
export const EditUserDialog = ({ user }: EditUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, control } = useForm<FormValues>({
    defaultValues: { nickname: user.nickname, status: user.status },
  });
  const updateUser = useUpdateUser(() => setOpen(false));

  const onSubmit = (values: FormValues) =>
    updateUser.mutate({ id: user.id, ...values });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size='sm'
          variant='outline'
          className='border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg h-8 px-3 text-xs gap-1'
        >
          <Pencil className='w-3.5 h-3.5' />
          수정
        </Button>
      </DialogTrigger>
      <DialogContent className='border-slate-800 bg-slate-900 text-slate-100 max-w-sm backdrop-blur-md rounded-2xl'>
        <DialogHeader>
          <DialogTitle className='text-lg font-bold text-white'>
            사용자 정보 수정
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 pt-2'>
          <div className='space-y-2'>
            <Label className='text-sm font-semibold text-slate-300'>
              닉네임
            </Label>
            <Input
              {...register("nickname", { required: true })}
              className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl focus:ring-blue-500'
            />
          </div>

          <div className='space-y-2'>
            <Label className='text-sm font-semibold text-slate-300'>
              계정 상태
            </Label>
            <Controller
              name='status'
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className='w-full border-slate-800 bg-slate-950 text-slate-200 rounded-xl'>
                    <SelectValue placeholder='상태 선택' />
                  </SelectTrigger>
                  <SelectContent className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl'>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className='flex justify-end gap-2 pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
              className='border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl'
            >
              취소
            </Button>
            <Button
              type='submit'
              disabled={updateUser.isPending}
              className='bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold'
            >
              {updateUser.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
