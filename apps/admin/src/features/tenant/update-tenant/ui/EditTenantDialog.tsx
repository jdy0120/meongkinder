"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Pencil, AlertTriangle } from "lucide-react";
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
          className='cursor-pointer gap-1.5 border-transparent bg-transparent px-3 text-text-muted neu-press'
        >
          <Pencil className='size-4' />
          수정
        </Button>
      </DialogTrigger>

      <DialogContent className='gap-5 p-6 sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='text-card text-foreground'>
            테넌트 정보 수정
          </DialogTitle>
        </DialogHeader>

        {/* 행 간격은 admin 테마(globals.css)가 `> form > * + *` 로 보장한다 —
            화면마다 space-y 를 다시 적는 대신 한 곳에서 정한다. */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>매장 이름</Label>
            <Input
              {...register("name", { required: true })}
              className='border-transparent neu-inset'
            />
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>서브도메인</Label>
            <Input
              {...register("subdomain", { required: true })}
              className='border-transparent font-mono neu-inset'
            />
            {subdomainChanged && (
              <p className='flex items-start gap-1.5 rounded-xl bg-caution-tint px-3 py-2 text-meta text-caution-text'>
                <AlertTriangle className='mt-px size-3.5 shrink-0' />
                서브도메인을 변경하면 기존 접속 주소로는 더 이상 접근할 수
                없습니다.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => handleOpenChange(false)}
              className='cursor-pointer border-transparent bg-transparent px-5 text-text-muted neu-press'
            >
              취소
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={updateTenant.isPending}
              className='cursor-pointer px-5'
            >
              {updateTenant.isPending ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
