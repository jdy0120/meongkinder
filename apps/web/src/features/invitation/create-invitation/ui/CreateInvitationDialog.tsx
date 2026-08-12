"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { UserPlus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ROLES, type CreateInvitationRequest } from "@pawlog/shared";

import { PhoneInput } from "@/shared/ui";
import { useCreateInvitation } from "../model/useCreateInvitation";

type FormValues = CreateInvitationRequest;

/**
 * 구성원 초대 다이얼로그 (feature ui).
 *
 * **자격을 주는 것이 전부다** (job-058). 이미 회원이면 그 자리에서 소속되고, 아직
 * 아니면 연락처만 저장해 뒀다가 가입 시 자동으로 연결한다.
 *
 * 아이 정보 칸(보호자 이름·아이 이름·종·품종·메모)을 없앤 이유: 미가입 보호자의 아이는
 * **원생 등록**(`/tenant/[tenant]/pets`)이 맡는다. 그쪽은 계정 없이 아이를 즉시 만들어
 * 그날부터 등하원·사진·알림톡이 돌아가는데, 초대에 담아 두면 보호자가 가입할 때까지
 * 아무것도 못 한다. 두 화면이 같은 일을 하면 원장은 더 나쁜 쪽을 고를 수 있게 된다.
 */
export const CreateInvitationDialog = () => {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, control, reset } = useForm<FormValues>({
    defaultValues: { role: ROLES.GUARDIAN },
  });
  const createInvitation = useCreateInvitation(() => {
    reset({ role: ROLES.GUARDIAN });
    setOpen(false);
  });

  const onSubmit = (values: FormValues) => {
    // 빈 문자열을 그대로 보내면 서버의 이메일 형식 검증에 걸린다.
    createInvitation.mutate({
      ...values,
      email: values.email || undefined,
      phone: values.phone || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className='h-4 w-4' />
          구성원 초대
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            구성원 초대
          </DialogTitle>
          <DialogDescription>
            이미 가입한 회원이면 곧바로 추가되고, 아직 회원이 아니면 연락처를 저장해
            뒀다가 가입 시 자동으로 연결합니다. 아이 등록은 원생 관리에서 합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 pt-2'>
          <div className='space-y-2'>
            <Label>자격</Label>
            <Controller
              name='role'
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='자격 선택' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROLES.GUARDIAN}>보호자</SelectItem>
                    <SelectItem value={ROLES.STAFF}>돌봄 스태프</SelectItem>
                    <SelectItem value={ROLES.TENANT_ADMIN}>관리자</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className='space-y-2'>
            <Label>
              이메일
            </Label>
            <Input
              type='email'
              placeholder='guardian@example.com'
              {...register("email")}
            />
          </div>

          <div className='space-y-2'>
            <Label>
              휴대폰 번호
            </Label>
            <Controller
              control={control}
              name='phone'
              render={({ field }) => (
                <PhoneInput value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
            <p>
              이메일과 휴대폰 번호 중 하나는 반드시 입력해야 합니다.
            </p>
          </div>

          <div className='flex justify-end gap-2 pt-1'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button
              type='submit'
              disabled={createInvitation.isPending}
            >
              {createInvitation.isPending ? "초대 중…" : "초대"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
