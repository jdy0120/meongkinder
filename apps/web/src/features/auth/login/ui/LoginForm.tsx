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
import type { LoginRequest } from "@pawlog/shared";

import { useLogin } from "../model/useLogin";

/**
 * 로그인 폼 (feature ui). react-hook-form 으로 입력을 다루고,
 * 제출은 useLogin 뮤테이션에 위임한다.
 *
 * 소셜 로그인 버튼은 여기서 렌더하지 않는다 — feature 끼리는 서로를 import 하지 않으며
 * (CLAUDE.md §7), 두 로그인 수단을 나란히 놓는 조합은 view 의 몫이다.
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
        // 서버 메시지를 그대로 쓴다. 로그인 실패는 계정 열거 방지를 위해 서버가 이미
        // "이메일 또는 비밀번호가 올바르지 않습니다." 로 뭉뚱그려 주고, 그 밖의 실패
        // (예: API 가 안 떠 있음)까지 같은 문구로 덮으면 개발 중에 원인을 못 찾는다.
        <FieldError>
          {login.error?.response?.data?.message ??
            "로그인에 실패했습니다. 잠시 후 다시 시도해주세요."}
        </FieldError>
      )}

      <Button type='submit' disabled={login.isPending} className='w-full'>
        {login.isPending ? "로그인 중…" : "로그인"}
      </Button>

      <Link
        href='/auth/forgot-password'
        className='text-center text-sm text-muted-foreground hover:underline'
      >
        비밀번호를 잊으셨나요?
      </Link>
    </form>
  );
};
