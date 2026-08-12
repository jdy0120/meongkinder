"use client";

import { Controller, useForm } from "react-hook-form";
import { Button, Field, FieldLabel, Input } from "@pawlog/ui";

import { PhoneInput } from "@/shared/ui";

import { useUpdateProfile } from "../model/useUpdateProfile";

interface FormValues {
  nickname: string;
  phone: string;
}

interface ProfileFormProps {
  defaultValues: { nickname: string; phone: string | null };
}

/**
 * 내 정보 수정 폼 (feature ui).
 * 전화번호를 왜 넣어야 하는지 안내한다 — 매장이 번호로 미리 등록해 둔 초대와 연결되는
 * 유일한 경로이기 때문이다.
 */
export const ProfileForm = ({ defaultValues }: ProfileFormProps) => {
  const { register, handleSubmit, control } = useForm<FormValues>({
    defaultValues: {
      nickname: defaultValues.nickname,
      phone: defaultValues.phone ?? "",
    },
  });
  const updateProfile = useUpdateProfile();

  const onSubmit = (values: FormValues) =>
    updateProfile.mutate({
      nickname: values.nickname,
      phone: values.phone || undefined,
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <Field>
        <FieldLabel htmlFor='nickname'>닉네임</FieldLabel>
        <Input id='nickname' {...register("nickname", { required: true })} />
      </Field>

      <Field>
        <FieldLabel htmlFor='phone'>휴대폰 번호</FieldLabel>
        <Controller
          control={control}
          name='phone'
          render={({ field }) => (
            <PhoneInput
              id='phone'
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <p className='text-xs text-muted-foreground'>
          매장에서 이 번호로 미리 등록해 두었다면, 저장하는 즉시 해당 매장에
          연결되고 아이 정보도 함께 등록됩니다.
        </p>
      </Field>

      <Button type='submit' disabled={updateProfile.isPending}>
        {updateProfile.isPending ? "저장 중…" : "저장"}
      </Button>
    </form>
  );
};
