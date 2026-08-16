"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { UserPlus, Plus, RefreshCw } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@pawlog/ui";
import {
  formatPhone,
  normalizePhone,
  PHONE_MAX_DIGITS,
  ROLES,
  type CreatePlatformUserRequest,
  type PlatformRole,
} from "@pawlog/shared";

import { useCreatePlatformUser } from "../model/useCreatePlatformUser";

/** 운영자가 불러줄 수 있는 초기 비밀번호. 모호한 글자(0/O, 1/l)는 뺀다. */
const generatePassword = () => {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
};

/**
 * 계정 발급 다이얼로그 (feature ui).
 *
 * 두 가지 용도가 있다:
 *   1) **운영진 계정** — `apps/admin` 은 이메일+비밀번호 로그인이고 가입 화면이 없다.
 *      새 운영자를 들이는 유일한 경로가 여기다.
 *   2) **대행 가입** — 카카오 로그인이 어려운 회원을 운영자가 대신 만들어 준다.
 *      전화번호를 넣으면 매장이 미리 등록해 둔 아이·초대가 즉시 연결된다.
 */
export const CreatePlatformUserDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<PlatformRole>(ROLES.USER);
  // 전화번호만 react-hook-form 바깥에 둔다 — 표시(하이픈)와 저장(숫자)이 다른
  // 완전 제어 입력이라, register 로는 두 형태를 동시에 만족시킬 수 없다.
  const [phone, setPhone] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreatePlatformUserRequest>();

  const close = () => {
    reset();
    setRole(ROLES.USER);
    setPhone("");
    setIsOpen(false);
  };

  const createUser = useCreatePlatformUser(close);

  const onSubmit = (values: CreatePlatformUserRequest) =>
    createUser.mutate({
      email: values.email.trim(),
      password: values.password,
      nickname: values.nickname.trim(),
      // 빈 문자열은 보내지 않는다 — "값 없음"과 구분되어야 한다.
      ...(phone ? { phone } : {}),
      role,
    });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => (open ? setIsOpen(true) : close())}
    >
      <DialogTrigger asChild>
        <Button size='sm' className='cursor-pointer gap-1.5 px-5'>
          <Plus className='size-4' />
          회원 등록
        </Button>
      </DialogTrigger>

      <DialogContent className='gap-5 p-6 sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-card text-foreground'>
            <UserPlus className='size-5 text-brand' />
            회원 등록
          </DialogTitle>
        </DialogHeader>

        {/* 행 간격은 admin 테마(globals.css)의 `> form > * + *` 가 보장한다. */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>이메일</Label>
            <Input
              type='email'
              autoComplete='off'
              placeholder='user@example.com'
              className='border-transparent neu-inset'
              {...register("email", {
                required: "이메일을 입력하세요.",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "이메일 형식이 올바르지 않습니다.",
                },
              })}
            />
            <p className='text-meta text-text-meta'>
              같은 이메일로 카카오 로그인을 하면 이 계정에 자동으로 연결됩니다.
            </p>
            {errors.email && (
              <p className='text-meta text-danger-strong'>
                {errors.email.message}
              </p>
            )}
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>닉네임</Label>
            <Input
              placeholder='예: 홍길동'
              className='border-transparent neu-inset'
              {...register("nickname", { required: "닉네임을 입력하세요." })}
            />
            {errors.nickname && (
              <p className='text-meta text-danger-strong'>
                {errors.nickname.message}
              </p>
            )}
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>초기 비밀번호</Label>
            <div className='flex gap-2'>
              <Input
                type='text'
                autoComplete='off'
                placeholder='8자 이상'
                className='border-transparent font-mono neu-inset'
                {...register("password", {
                  required: "비밀번호를 입력하세요.",
                  minLength: { value: 8, message: "8자 이상 입력하세요." },
                })}
              />
              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  setValue("password", generatePassword(), {
                    shouldValidate: true,
                  })
                }
                className='shrink-0 cursor-pointer gap-1.5 border-transparent bg-transparent px-4 text-text-muted neu-press'
              >
                <RefreshCw className='size-4' />
                생성
              </Button>
            </div>
            <p className='text-meta text-text-meta'>
              본인에게 전달한 뒤 변경하도록 안내하세요. 화면을 닫으면 다시 볼 수
              없습니다.
            </p>
            {errors.password && (
              <p className='text-meta text-danger-strong'>
                {errors.password.message}
              </p>
            )}
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>
              휴대폰 번호 <span className='text-text-meta'>(선택)</span>
            </Label>
            <Input
              type='tel'
              inputMode='numeric'
              placeholder='010-1234-5678'
              // 저장은 숫자만, 화면은 하이픈 (job-043). 붙여넣기도 여기서 걸러진다.
              value={formatPhone(phone)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPhone(normalizePhone(e.target.value).slice(0, PHONE_MAX_DIGITS))
              }
              className='border-transparent neu-inset'
            />
            <p className='text-meta text-text-meta'>
              매장이 이 번호로 미리 등록해 둔 아이·초대가 있으면 등록 즉시
              연결됩니다.
            </p>
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>플랫폼 역할</Label>
            <Select
              value={role}
              onValueChange={(value: string) => setRole(value as PlatformRole)}
            >
              <SelectTrigger className='w-full border-transparent neu-inset'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLES.USER}>일반 회원</SelectItem>
                <SelectItem value={ROLES.SUPER_ADMIN}>플랫폼 관리자</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-meta text-text-meta'>
              매장 안에서의 자격(보호자·스태프·관리자)은 각 매장의 구성원
              관리에서 부여합니다.
            </p>
          </div>

          <p className='rounded-xl px-4 py-3 text-meta leading-relaxed text-text-muted neu-inset'>
            약관 동의는 대신 처리하지 않습니다. 본인이 처음 서비스에 들어올 때
            동의 화면을 거칩니다.
          </p>

          <DialogFooter>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={close}
              className='cursor-pointer border-transparent bg-transparent px-5 text-text-muted neu-press'
            >
              취소
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={createUser.isPending}
              className='cursor-pointer gap-1.5 px-5'
            >
              {createUser.isPending && <Spinner className='size-4' />}
              등록
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
