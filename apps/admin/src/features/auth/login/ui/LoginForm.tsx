"use client";

import { useForm } from "react-hook-form";

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from "@pawlog/ui";
import type { LoginRequest } from "@pawlog/shared";

import { NOT_ADMIN, useLogin } from "../model/useLogin";

/**
 * 관리자 로그인 폼 (feature ui). 입력은 react-hook-form, 제출은 useLogin 에 위임.
 */
export const LoginForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>();
  const login = useLogin();

  const onSubmit = (values: LoginRequest) => login.mutate(values);

  const serverError = !login.isError
    ? null
    : login.error?.message === NOT_ADMIN
      ? "플랫폼 운영자 권한이 없는 계정입니다."
      : "이메일 또는 비밀번호가 올바르지 않습니다.";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <Field>
        <FieldLabel htmlFor='email'>이메일</FieldLabel>
        <Input
          id='email'
          type='email'
          autoComplete='email'
          placeholder='admin@example.com'
          className='border-transparent neu-inset'
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
          className='border-transparent neu-inset'
          {...register("password", {
            required: "비밀번호를 입력하세요.",
            minLength: { value: 8, message: "8자 이상 입력하세요." },
          })}
        />
        {errors.password && <FieldError>{errors.password.message}</FieldError>}
      </Field>

      {serverError && <FieldError>{serverError}</FieldError>}

      <Button type='submit' disabled={login.isPending} className='w-full'>
        {login.isPending ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
};
