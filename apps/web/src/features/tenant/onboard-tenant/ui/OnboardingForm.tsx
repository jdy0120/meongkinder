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
import { createDefaultBusinessHours, validateBusinessHours } from "@pawlog/shared";
import type {
  BusinessHours,
  OnboardTenantRequest,
  TenantAddressInput,
} from "@pawlog/shared";

import { AddressField, BusinessHoursField } from "@/shared/ui";
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

  /**
   * 운영시간은 **기본값을 미리 채워** 시작한다 (job-060).
   *
   * 매장 설정 화면에서는 `null`(미등록)로 시작하는 것과 반대인데, 그건 아무도 입력한 적
   * 없는 값을 서버가 조용히 채우면 안 되기 때문이었다. 여기서는 원장이 그 값을 **눈으로
   * 보면서** 개설을 누르므로 확인한 것이 된다.
   *
   * 이 차이가 중요한 이유: 운영시간이 없으면 보호자의 등원 예약 달력이 통째로 잠긴다.
   * 개설 첫날부터 예약을 받을 수 있게 하려면 여기서 채워지는 편이 낫다.
   */
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(
    createDefaultBusinessHours,
  );

  const subdomain = watch("subdomain") ?? "";
  const availability = useSubdomainAvailability(subdomain);

  // 서버도 같은 함수로 검사한다. 여기서 먼저 보는 이유는 400 을 왕복하지 않고 어느
  // 요일이 문제인지 그 자리에서 보여주기 위해서다.
  const businessHoursErrors = businessHours
    ? validateBusinessHours(businessHours)
    : [];

  const onSubmit = (values: OnboardTenantRequest) => {
    if (businessHoursErrors.length > 0) return;
    onboard.mutate({ ...values, ...address, businessHours });
  };

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

        {/*
          job-060: 운영시간도 **선택**이지만 기본값이 미리 채워져 있다. 보호자의 등원
          예약 달력이 이 값으로 열리므로, 개설 시점에 맞춰 두면 첫날부터 예약을 받는다.
          필요 없으면 "등록 해제"로 비울 수 있다.
        */}
        <BusinessHoursField
          value={businessHours}
          onChange={setBusinessHours}
        />

        <Button
          type='submit'
          disabled={onboard.isPending || businessHoursErrors.length > 0}
          className='w-full'
        >
          {onboard.isPending ? "개설 중…" : "매장 개설"}
        </Button>
      </FieldGroup>
    </form>
  );
};
