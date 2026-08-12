"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from "@pawlog/ui";
import type { OnboardTenantRequest, TenantAddressInput } from "@pawlog/shared";

import { AddressField } from "@/shared/ui";
import { useOnboardTenant } from "../model/useOnboardTenant";
import { useSubdomainAvailability } from "../model/useSubdomainAvailability";

const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * 매장 개설 폼 (feature ui) — job-034.
 *
 * 로그인한 회원이 보유한 **매장 개설권 구독 1건을 소비**해 매장을 만든다.
 * 요청자가 곧바로 그 매장의 TENANT_ADMIN 이 되므로 관리자 계정 정보를 따로 받지 않는다.
 * (개설권이 없으면 서버가 403 을 반환한다 — 구독 결제가 선행되어야 한다)
 */
export const OnboardingForm = () => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OnboardTenantRequest>();
  const onboard = useOnboardTenant();

  // 주소는 우편번호 팝업이 값을 통째로 갈아끼우므로 register 가 아니라 별도 상태로 든다.
  const [address, setAddress] = useState<TenantAddressInput>({});

  const subdomain = watch("subdomain") ?? "";
  const availability = useSubdomainAvailability(subdomain);

  const onSubmit = (values: OnboardTenantRequest) =>
    onboard.mutate({ ...values, ...address });

  const subdomainHint = !subdomain
    ? null
    : availability.isFetching
      ? "확인 중…"
      : availability.result?.available
        ? "사용 가능한 서브도메인입니다."
        : (availability.result?.reason ?? null);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor='tenantName'>테넌트(매장) 이름</FieldLabel>
          <Input
            id='tenantName'
            placeholder='멍멍이 유치원'
            {...register("tenantName", { required: "테넌트 이름을 입력하세요." })}
          />
          {errors.tenantName && <FieldError>{errors.tenantName.message}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor='subdomain'>서브도메인</FieldLabel>
          <Input
            id='subdomain'
            placeholder='mungmung'
            autoCapitalize='off'
            autoCorrect='off'
            {...register("subdomain", {
              required: "서브도메인을 입력하세요.",
              pattern: {
                value: SUBDOMAIN_PATTERN,
                message: "소문자 영문/숫자와 하이픈(-)만 사용할 수 있습니다.",
              },
              minLength: { value: 2, message: "2자 이상 입력하세요." },
            })}
          />
          {errors.subdomain ? (
            <FieldError>{errors.subdomain.message}</FieldError>
          ) : (
            subdomainHint && (
              <FieldDescription
                className={
                  availability.result?.available
                    ? "text-primary"
                    : "text-destructive"
                }
              >
                {subdomainHint}
              </FieldDescription>
            )
          )}
        </Field>

        {/*
          job-059: 주소는 **선택**이다. 개설을 주소에 묶으면 아직 자리를 못 구한 매장이
          시작조차 못 한다. 안 넣으면 지도에만 안 뜨고, 나중에 매장 설정에서 넣으면 된다.
        */}
        <AddressField
          value={address}
          onChange={setAddress}
          description='선택 입력입니다. 등록하면 보호자가 지도에서 우리 매장을 찾을 수 있습니다. 나중에 매장 설정에서 넣어도 됩니다.'
        />

        <Button type='submit' disabled={onboard.isPending} className='w-full'>
          {onboard.isPending ? "개설 중…" : "매장 개설"}
        </Button>
      </FieldGroup>
    </form>
  );
};
