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
} from "@pawlog/ui";
import type {
  TenantAddressInput,
  TenantSettings,
  UpdateTenantSettingsRequest,
} from "@pawlog/shared";

import { AddressField, PhoneInput } from "@/shared/ui";
import {
  useTenantSettings,
  useUpdateTenantSettings,
} from "../model/useTenantSettings";

type FormValues = {
  name: string;
  contactPhone: string;
  isListed: boolean;
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

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: settings.name,
      contactPhone: settings.contactPhone ?? "",
      isListed: settings.isListed,
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload: UpdateTenantSettingsRequest = {
      name: values.name,
      contactPhone: values.contactPhone,
      isListed: values.isListed,
      ...address,
    };
    update.mutate(payload);
  };

  const onMap = Boolean(settings.latitude && settings.longitude);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-6'>
      <Card>
        <CardContent className='pt-6'>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor='name'>매장 이름</FieldLabel>
              <Input
                id='name'
                {...register("name", { required: "매장 이름을 입력하세요." })}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor='contactPhone'>대표 연락처</FieldLabel>
              <Controller
                control={control}
                name='contactPhone'
                render={({ field }) => (
                  <PhoneInput
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

      <Button type='submit' disabled={update.isPending}>
        {update.isPending ? "저장 중…" : "저장"}
      </Button>
    </form>
  );
};
