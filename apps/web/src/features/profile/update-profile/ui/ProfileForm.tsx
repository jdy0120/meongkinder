"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button, Field, FieldLabel, Input } from "@pawlog/ui";

import { PhoneVerifyField } from "@/features/auth/verify-phone";
import { usePets } from "@/entities/pet";
import { AvatarUpload } from "@/entities/file";

import { useUpdateProfile } from "../model/useUpdateProfile";
import { SyncPetPhoneDialog } from "./SyncPetPhoneDialog";

interface FormValues {
  nickname: string;
  phone: string;
  /** 빈 문자열이면 "지웠다" — 서버가 그것과 "안 보냄"을 구분한다. */
  profileImageFileId: string;
}

interface ProfileFormProps {
  defaultValues: {
    nickname: string;
    phone: string | null;
    profileImageFileId: string | null;
  };
}

/**
 * 내 정보 수정 폼 (feature ui).
 * 전화번호를 왜 넣어야 하는지 안내한다 — 매장이 번호로 미리 등록해 둔 초대와 연결되는
 * 유일한 경로이기 때문이다.
 */
export const ProfileForm = ({ defaultValues }: ProfileFormProps) => {
  const { register, handleSubmit, control, watch } = useForm<FormValues>({
    defaultValues: {
      nickname: defaultValues.nickname,
      phone: defaultValues.phone ?? "",
      profileImageFileId: defaultValues.profileImageFileId ?? "",
    },
  });
  const updateProfile = useUpdateProfile();
  const { data: pets } = usePets();

  // 번호를 바꾸는 중이면 저장 전에 한 번 멈춘다 (job-060).
  const [pendingChange, setPendingChange] = useState<FormValues | null>(null);
  // job-042: 번호를 바꾸려면 본인확인을 마쳐야 한다. 처음 상태(= 원래 번호 그대로)는 통과.
  const [phoneVerified, setPhoneVerified] = useState(true);

  const previousPhone = defaultValues.phone ?? "";

  /**
   * 옛 번호를 **그대로 쓰고 있던** 내 아이들. 매장이 일부러 다른 번호를 적어 둔 아이는
   * 여기 들어오지 않는다 — 그건 덮으면 안 되는 값이다.
   */
  const affectedPets = (pets ?? []).filter(
    (pet) => pet.guardianPhone && pet.guardianPhone === previousPhone,
  );

  const save = (values: FormValues, syncPetIds?: string[]) =>
    updateProfile.mutate({
      nickname: values.nickname,
      phone: values.phone || undefined,
      // 사진은 **언제나 보낸다.** 빈 문자열이 곧 "지웠다"이고, 안 보내면 서버가 기존
      // 값을 유지하므로 삭제가 저장되지 않는다.
      profileImageFileId: values.profileImageFileId,
      ...(syncPetIds?.length ? { syncPetIds } : {}),
    });

  const onSubmit = (values: FormValues) => {
    const changingPhone =
      Boolean(values.phone) && values.phone !== previousPhone;

    // 번호를 바꾸는데 그 번호로 알림받던 아이가 있으면 물어본다.
    if (changingPhone && affectedPets.length > 0) {
      setPendingChange(values);
      return;
    }
    save(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <Controller
        control={control}
        name='profileImageFileId'
        render={({ field }) => (
          <AvatarUpload
            value={field.value || undefined}
            // AvatarUpload 는 삭제를 `undefined` 로 알린다. 폼은 빈 문자열로 들고 있어야
            // "지웠다"가 서버까지 간다 — `undefined` 로 두면 payload 에서 빠진다.
            onChange={(fileId) => field.onChange(fileId ?? "")}
            name={watch("nickname")}
          />
        )}
      />

      <Field>
        <FieldLabel htmlFor='nickname'>닉네임</FieldLabel>
        <Input id='nickname' {...register("nickname", { required: true })} />
      </Field>

      <Field>
        <Controller
          control={control}
          name='phone'
          render={({ field }) => (
            <PhoneVerifyField
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                // 원래 번호로 되돌리면 바꾸는 게 아니므로 인증이 필요 없다.
                setPhoneVerified(next === previousPhone);
              }}
              onVerifiedChange={setPhoneVerified}
              description='번호를 바꾸려면 본인확인이 필요합니다. 이 번호로 등록된 아이의 알림장·사진이 함께 연결되기 때문입니다.'
            />
          )}
        />
        <p className='text-xs text-muted-foreground'>
          매장에서 이 번호로 미리 등록해 두었다면, 저장하는 즉시 해당 매장에
          연결되고 아이 정보도 함께 등록됩니다.
        </p>
      </Field>

      <Button
        type='submit'
        disabled={updateProfile.isPending || !phoneVerified}
      >
        {updateProfile.isPending ? "저장 중…" : "저장"}
      </Button>

      {pendingChange && (
        <SyncPetPhoneDialog
          open
          pets={affectedPets}
          previousPhone={previousPhone}
          newPhone={pendingChange.phone}
          isPending={updateProfile.isPending}
          onCancel={() => setPendingChange(null)}
          onConfirm={(petIds) => {
            save(pendingChange, petIds);
            setPendingChange(null);
          }}
        />
      )}
    </form>
  );
};
