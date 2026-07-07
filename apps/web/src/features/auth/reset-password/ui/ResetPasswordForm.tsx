"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from "@template/ui";

import { useResetPassword } from "../model/useResetPassword";

interface FormValues {
  password: string;
  confirmPassword: string;
}

/**
 * 비밀번호 재설정 폼 (feature ui). URL 의 토큰(prop)과 새 비밀번호로 재설정한다.
 */
export const ResetPasswordForm = ({ token }: { token?: string }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>();
  const reset = useResetPassword();

  const onSubmit = (values: FormValues) => {
    if (!token) return;
    reset.mutate({ token, password: values.password });
  };

  // 토큰 없이 접근한 경우 (링크 손상 등)
  if (!token) {
    return (
      <div className='flex flex-col gap-4 text-sm text-muted-foreground'>
        <p>유효하지 않은 접근입니다. 재설정 링크를 다시 요청해주세요.</p>
        <Button asChild variant='outline' className='w-full'>
          <Link href='/auth/forgot-password'>비밀번호 찾기</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <Field>
        <FieldLabel htmlFor='password'>새 비밀번호</FieldLabel>
        <Input
          id='password'
          type='password'
          autoComplete='new-password'
          placeholder='••••••••'
          {...register("password", {
            required: "비밀번호를 입력하세요.",
            minLength: { value: 8, message: "8자 이상 입력하세요." },
          })}
        />
        {errors.password && <FieldError>{errors.password.message}</FieldError>}
      </Field>

      <Field>
        <FieldLabel htmlFor='confirmPassword'>새 비밀번호 확인</FieldLabel>
        <Input
          id='confirmPassword'
          type='password'
          autoComplete='new-password'
          placeholder='••••••••'
          {...register("confirmPassword", {
            required: "비밀번호를 한 번 더 입력하세요.",
            validate: (value) =>
              value === watch("password") || "비밀번호가 일치하지 않습니다.",
          })}
        />
        {errors.confirmPassword && (
          <FieldError>{errors.confirmPassword.message}</FieldError>
        )}
      </Field>

      {reset.isError && (
        <FieldError>유효하지 않거나 만료된 링크입니다.</FieldError>
      )}

      <Button type='submit' disabled={reset.isPending} className='w-full'>
        {reset.isPending ? "변경 중…" : "비밀번호 변경"}
      </Button>
    </form>
  );
};
