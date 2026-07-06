"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from "@template/ui";
import { Post } from "@/shared/libs/axios/request";
import { ROLES } from "@template/shared";
import type { LoginRequest, LoginResponse } from "@template/shared";

export const LoginPage = () => {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>();

  const onSubmit = async (values: LoginRequest) => {
    setServerError("");
    try {
      const res = await Post<LoginResponse, LoginRequest>(
        "/v1/auth/login",
        values,
      );

      // 관리자 앱은 ADMIN 만 허용. 아니면 세션(쿠키)을 정리하고 거부한다.
      if (res.data.data?.user.role !== ROLES.ADMIN) {
        await Post("/v1/auth/logout", {});
        setServerError("관리자 권한이 없는 계정입니다.");
        return;
      }

      router.replace("/");
    } catch {
      setServerError("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-muted p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>관리자 로그인</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
            <Field>
              <FieldLabel htmlFor='email'>이메일</FieldLabel>
              <Input
                id='email'
                type='email'
                autoComplete='email'
                placeholder='admin@example.com'
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
              {errors.password && (
                <FieldError>{errors.password.message}</FieldError>
              )}
            </Field>

            {serverError && <FieldError>{serverError}</FieldError>}

            <Button type='submit' disabled={isSubmitting} className='w-full'>
              {isSubmitting ? "로그인 중…" : "로그인"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
