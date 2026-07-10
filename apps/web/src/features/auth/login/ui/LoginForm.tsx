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
import type { LoginRequest } from "@template/shared";

import { SocialLoginButtons } from "@/features/auth/social-login";

import { useLogin } from "../model/useLogin";

/**
 * 로그인 폼 (feature ui). react-hook-form 으로 입력을 다루고,
 * 제출은 useLogin 뮤테이션에 위임한다.
 */
export const LoginForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>();
  const login = useLogin();

  const onSubmit = (values: LoginRequest) => login.mutate(values);

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

      <Field>
        <FieldLabel htmlFor='password'>비밀번호</FieldLabel>
        <Input
          id='password'
          type='password'
          autoComplete='current-password'
          placeholder='••••••••'
          {...register("password", {
            required: "비밀번호를 입력하세요.",
            minLength: { value: 8, message: "8자 이상 입력하세요." },
          })}
        />
        {errors.password && <FieldError>{errors.password.message}</FieldError>}
      </Field>

      {login.isError && (
        <FieldError>이메일 또는 비밀번호가 올바르지 않습니다.</FieldError>
      )}

      <Button type='submit' disabled={login.isPending} className='w-full'>
        {login.isPending ? "로그인 중…" : "로그인"}
      </Button>

      <div className='flex items-center gap-3 text-xs text-muted-foreground'>
        <span className='h-px flex-1 bg-border' />
        또는
        <span className='h-px flex-1 bg-border' />
      </div>

      <SocialLoginButtons />

      <Link
        href='/auth/forgot-password'
        className='text-center text-sm text-muted-foreground hover:underline'
      >
        비밀번호를 잊으셨나요?
      </Link>
    </form>
  );
};
