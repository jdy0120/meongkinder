"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from "@pawlog/ui";
import type { ForgotPasswordRequest } from "@pawlog/shared";

import { useForgotPassword } from "../model/useForgotPassword";

/**
 * 비밀번호 찾기 폼 (feature ui). 이메일 제출 → 재설정 링크 발송.
 * 성공 시 안내 메시지를 노출한다.
 */
export const ForgotPasswordForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordRequest>();
  const forgot = useForgotPassword();

  const onSubmit = (values: ForgotPasswordRequest) => forgot.mutate(values);

  if (forgot.isSuccess) {
    return (
      <div className='flex flex-col gap-4 text-sm text-muted-foreground'>
        <p>
          가입된 이메일이라면 비밀번호 재설정 링크를 보냈습니다. 메일함을
          확인해주세요.
        </p>
        <Button asChild variant='outline' className='w-full'>
          <Link href='/auth/login'>로그인으로 돌아가기</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <Field>
        <FieldLabel htmlFor='email'>이메일</FieldLabel>
        <Input
          id='email'
          type='email'
          autoComplete='email'
          placeholder='user@example.com'
          {...register("email", { required: "이메일을 입력하세요." })}
        />
        {errors.email && <FieldError>{errors.email.message}</FieldError>}
      </Field>

      {forgot.isError && (
        <FieldError>잠시 후 다시 시도해주세요.</FieldError>
      )}

      <Button type='submit' disabled={forgot.isPending} className='w-full'>
        {forgot.isPending ? "전송 중…" : "재설정 링크 받기"}
      </Button>

      <Button asChild variant='ghost' className='w-full'>
        <Link href='/auth/login'>로그인으로 돌아가기</Link>
      </Button>
    </form>
  );
};
