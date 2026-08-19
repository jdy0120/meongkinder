"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Button,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Switch,
  Textarea,
} from "@pawlog/ui";
import { validateBusinessHours } from "@pawlog/shared";
import type {
  BusinessHours,
  TenantAddressInput,
  TenantSettings,
  UpdateTenantSettingsRequest,
} from "@pawlog/shared";

import { AvatarUpload } from "@/entities/file";
import { AddressField, BusinessHoursField, PhoneInput } from "@/shared/ui";
import {
  useTenantSettings,
  useUpdateTenantSettings,
} from "../model/useTenantSettings";
import { ClosuresField } from "./ClosuresField";

type FormValues = {
  name: string;
  contactPhone: string;
  isListed: boolean;
  /** 매장 소개 (job-063). 공개 매장 찾기에 그대로 나간다. */
  description: string;
  /** 대표 이미지. 빈 문자열이면 "지웠다" — 서버가 "안 보냄"과 구분한다. */
  profileImageFileId: string;
};

/**
 * 매장 설정 폼 (feature ui) — job-059.
 *
 * 원장이 자기 매장 정보를 고치는 유일한 화면이다. 여기가 생기기 전에는 매장 수정 API 가
 * SUPER_ADMIN 전용이라 **원장이 자기 매장 주소를 넣을 방법이 아예 없었다.**
 *
 * 주소는 `react-hook-form` 밖에서 별도 상태로 든다 — 우편번호 팝업이 값을 통째로
 * 갈아끼우는 방식이라 register 보다 제어 컴포넌트가 맞다.
 */
export const TenantSettingsForm = () => {
  const { data: settings, isLoading } = useTenantSettings();

  if (isLoading) {
    return <p className='text-muted-foreground'>불러오는 중…</p>;
  }
  if (!settings) {
    return <p className='text-muted-foreground'>매장 정보를 불러오지 못했습니다.</p>;
  }

  // 데이터가 온 뒤에 폼을 마운트한다. 빈 폼을 먼저 그리고 effect 로 값을 밀어넣으면
  // 렌더가 한 번 더 돌고(React 규칙 위반), 사용자가 입력 중이면 그 값을 덮어쓴다.
  return <SettingsFields settings={settings} />;
};

const SettingsFields = ({ settings }: { settings: TenantSettings }) => {
  const update = useUpdateTenantSettings();

  const [address, setAddress] = useState<TenantAddressInput>({
    postalCode: settings.postalCode ?? "",
    roadAddress: settings.roadAddress ?? "",
    addressDetail: settings.addressDetail ?? "",
  });

  // 주소와 같은 이유로 `react-hook-form` 밖에 둔다 — 요일 7개가 중첩된 구조라
  // register 로는 다룰 수 없고, 편집기가 값을 통째로 갈아끼운다.
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(
    settings.businessHours,
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: settings.name,
      contactPhone: settings.contactPhone ?? "",
      isListed: settings.isListed,
      description: settings.description ?? "",
      profileImageFileId: settings.profileImageFileId ?? "",
    },
  });

  // 운영시간은 서버도 같은 함수로 검사한다(`validateBusinessHours`). 여기서 먼저 보는
  // 이유는 400 을 왕복하지 않고 어느 요일이 문제인지 그 자리에서 보여주기 위해서다.
  const businessHoursErrors = businessHours
    ? validateBusinessHours(businessHours)
    : [];

  const onSubmit = (values: FormValues) => {
    if (businessHoursErrors.length > 0) return;

    const payload: UpdateTenantSettingsRequest = {
      name: values.name,
      contactPhone: values.contactPhone,
      isListed: values.isListed,
      // 소개·이미지는 **언제나 보낸다.** 빈 문자열이 곧 "지웠다"이고, 안 보내면 서버가
      // 기존 값을 유지하므로 삭제가 저장되지 않는다.
      description: values.description,
      profileImageFileId: values.profileImageFileId,
      ...address,
      businessHours,
    };
    update.mutate(payload);
  };

  const onMap = Boolean(settings.latitude && settings.longitude);

  return (
    <div className='flex flex-col gap-4'>
      <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <Card>
        <CardContent className='pt-6'>
          <FieldGroup>
            <Controller
              control={control}
              name='profileImageFileId'
              render={({ field }) => (
                <AvatarUpload
                  value={field.value || undefined}
                  // AvatarUpload 는 삭제를 `undefined` 로 알린다. 폼은 빈 문자열로 들고
                  // 있어야 "지웠다"가 서버까지 간다.
                  onChange={(fileId) => field.onChange(fileId ?? "")}
                  name={watch("name")}
                />
              )}
            />

            <Field>
              <FieldLabel htmlFor='name'>매장 이름</FieldLabel>
              <Input
                id='name'
                {...register("name", { required: "매장 이름을 입력하세요." })}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor='description'>매장 소개</FieldLabel>
              <Textarea
                id='description'
                rows={4}
                maxLength={1000}
                placeholder='어떤 곳인지 한두 문단으로 적어주세요. 보호자가 매장을 고를 때 이름과 주소 다음으로 읽는 값입니다.'
                {...register("description")}
              />
              <p className='text-label text-muted-foreground'>
                공개 매장 찾기에 그대로 표시됩니다.
              </p>
            </Field>

            <Field>
              <FieldLabel htmlFor='contactPhone'>대표 연락처</FieldLabel>
              <Controller
                control={control}
                name='contactPhone'
                render={({ field }) => (
                  <PhoneInput
                    id='contactPhone'
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldDescription>
                알림장 공개 링크에 표시됩니다. 아직 가입하지 않은 보호자가 매장에
                문의할 수 있는 유일한 경로입니다.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor='subdomain'>매장 주소(서브도메인)</FieldLabel>
              <Input id='subdomain' value={settings.subdomain} readOnly />
              <FieldDescription>
                변경하면 이미 공유된 링크가 모두 끊어지므로 여기서는 바꿀 수
                없습니다. 변경이 필요하면 고객센터로 문의해주세요.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='flex flex-col gap-4 pt-6'>
          <AddressField
            value={address}
            onChange={setAddress}
            description='보호자가 지도에서 우리 매장을 찾을 때 쓰입니다. 상세주소(층·호)는 지도에 공개되지 않습니다.'
          />

          {address.roadAddress && !onMap && (
            <p className='text-label text-caution-foreground'>
              아직 지도에 표시되지 않습니다. 저장하면 주소로 위치를 찾습니다.
            </p>
          )}

          <div className='flex items-center justify-between gap-4 rounded-btn border p-4'>
            <div className='flex flex-col gap-1'>
              <span className='font-semibold'>매장 찾기에 공개</span>
              <span className='text-label text-muted-foreground'>
                끄면 보호자의 매장 찾기(지도·목록)에 나오지 않습니다. 이미 소속된
                보호자에게는 영향이 없습니다.
              </span>
            </div>
            <Controller
              control={control}
              name='isListed'
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <BusinessHoursField
        value={businessHours}
        onChange={setBusinessHours}
      />

      <Button
        type='submit'
        disabled={update.isPending || businessHoursErrors.length > 0}
      >
        {update.isPending ? "저장 중…" : "저장"}
      </Button>
      </form>

      {/*
        임시 휴무일은 위 폼 **바깥**이다 (job-060).

        ① 저장 버튼과 무관하게 즉시 반영된다 — 운영시간은 7일을 통째로 덮어쓰지만 휴무일은
           개별로 추가·삭제되므로, 같은 저장에 묶으면 휴무 하나를 지우려고 운영시간 전체를
           다시 보내야 하고 그 사이 다른 탭의 편집이 사라진다.
        ② 폼 안에 두면 날짜 선택 팝오버의 트리거 버튼이 **폼을 제출**할 수 있다.
      */}
      <ClosuresField />
    </div>
  );
};
