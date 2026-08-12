"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
} from "@pawlog/ui";

import { useUpdateTenant } from "../model/useUpdateTenant";

interface FormValues {
  name: string;
  subdomain: string;
}

interface EditTenantDialogProps {
  tenant: { id: string; name: string; subdomain: string };
}

/**
 * 테넌트 정보 수정 다이얼로그 (feature ui).
 * 서브도메인을 바꾸면 기존 접속 URL 이 즉시 무효화되므로, 변경이 감지될 때만 경고를 노출한다.
 */
export const EditTenantDialog = ({ tenant }: EditTenantDialogProps) => {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, control, reset } = useForm<FormValues>({
    defaultValues: { name: tenant.name, subdomain: tenant.subdomain },
  });
  const updateTenant = useUpdateTenant(() => setOpen(false));

  // watch() 대신 useWatch — watch 는 메모이제이션이 보장되지 않아 lint 가 막는다.
  const subdomain = useWatch({ control, name: "subdomain" });
  const subdomainChanged = subdomain !== tenant.subdomain;

  const handleOpenChange = (next: boolean) => {
    // 닫을 때 편집 중이던 값을 원복해, 다시 열었을 때 이전 입력이 남지 않도록 한다.
    if (!next) reset({ name: tenant.name, subdomain: tenant.subdomain });
    setOpen(next);
  };

  const onSubmit = (values: FormValues) =>
    updateTenant.mutate({ id: tenant.id, ...values });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
      <DialogContent className='border-slate-800 bg-slate-900 text-slate-100 backdrop-blur-md sm:max-w-lg rounded-2xl'>
        <DialogHeader>
          <DialogTitle className='text-lg font-bold text-white'>
            테넌트 정보 수정
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 pt-2'>
          <div className='space-y-2'>
            <Label className='text-sm font-semibold text-slate-300'>
              매장 이름
            </Label>
            <Input
              {...register("name", { required: true })}
              className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl focus:ring-blue-500'
            />
          </div>

          <div className='space-y-2'>
            <Label className='text-sm font-semibold text-slate-300'>
              서브도메인
            </Label>
            <Input
              {...register("subdomain", { required: true })}
              className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl focus:ring-blue-500'
            />
            {subdomainChanged && (
              <p className='text-xs text-amber-400'>
                서브도메인을 변경하면 기존 접속 주소로는 더 이상 접근할 수
                없습니다.
              </p>
            )}
          </div>

          <div className='flex justify-end gap-2 pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleOpenChange(false)}
              className='border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl'
            >
              취소
            </Button>
            <Button
              type='submit'
              disabled={updateTenant.isPending}
              className='bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold'
            >
              {updateTenant.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
