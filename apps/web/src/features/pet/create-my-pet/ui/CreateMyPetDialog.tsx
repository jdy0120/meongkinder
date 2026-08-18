"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@pawlog/ui";

import { GENDER_OPTIONS, SPECIES_OPTIONS } from "@/entities/pet";
import { PHOTO_CONSENT_OPTIONS } from "@/entities/feed";
import { AvatarUpload } from "@/entities/file";
import { useMe } from "@/entities/user";
import { DatePicker, PhoneInput } from "@/shared/ui";

import { useCreateMyPet } from "../model/useCreateMyPet";

interface FormValues {
  name: string;
  /** 업로드된 임시 파일 id. 서버가 저장 직전 영구 저장소로 옮긴다 (job-053). */
  profileImageFileId?: string;
  species: string;
  breed: string;
  birthDate: string;
  gender: string;
  isNeutered: boolean;
  weightKg?: number;
  guardianPhone: string;
  careNote: string;
  photoConsent: string;
}

const DEFAULT_VALUES: FormValues = {
  name: "",
  profileImageFileId: undefined,
  species: "DOG",
  breed: "",
  birthDate: "",
  gender: "",
  isNeutered: false,
  weightKg: undefined,
  guardianPhone: "",
  careNote: "",
  photoConsent: "CLASS",
};

/**
 * 보호자 연락처를 **내 번호로 채워 둔다** (job-060).
 *
 * 이 화면에서 아이를 등록하는 사람은 언제나 본인이고, 그 아이의 알림을 받을 사람도
 * 대개 본인이다. 그런데 비워 두면 `Pet.guardianPhone` 이 빈 채로 저장되고, 알림은
 * `resolveGuardianPhone` 의 폴백(`User.phone`)에 의존하게 된다. 폴백이 있으니 당장은
 * 동작하지만 **두 값이 갈라진 상태**로 남아서, 나중에 계정 번호를 바꾸면 어느 쪽을
 * 따라가야 하는지가 애매해진다(job-060 의 동기화 대상에서도 빠진다).
 *
 * 번호가 없는 계정이면 빈 칸으로 둔다 — 없는 값을 지어낼 수는 없다.
 */
const defaultsFor = (phone?: string | null): FormValues => ({
  ...DEFAULT_VALUES,
  guardianPhone: phone ?? "",
});

/**
 * 보호자 본인의 아이 등록 다이얼로그 (feature ui).
 *
 * 매장의 원생 등록 화면과 달리 보호자를 고르는 칸이 없다 — 언제나 로그인한 본인의 아이다.
 * 등록만으로는 어느 유치원에도 속하지 않고, 등원은 목록 카드의 등원 컨트롤에서 따로 한다.
 */
export const CreateMyPetDialog = () => {
  const [open, setOpen] = useState(false);
  const { data: me } = useMe();
  const { register, handleSubmit, control, reset, watch } = useForm<FormValues>({
    defaultValues: defaultsFor(me?.phone),
  });

  const createPet = useCreateMyPet(() => {
    reset(defaultsFor(me?.phone));
    setOpen(false);
  });

  /**
   * 다이얼로그를 열 때마다 기본값을 다시 깐다.
   *
   * `useMe()` 가 비동기라 첫 마운트 시점에는 번호가 아직 없을 수 있다. effect 로 밀어넣으면
   * 사용자가 입력 중인 값을 덮을 위험이 있고 렌더도 한 번 더 돈다 — **여는 순간**이
   * 폼이 비어 있는 것이 확실한 유일한 시점이라 여기서 처리한다.
   */
  const handleOpenChange = (next: boolean) => {
    if (next) reset(defaultsFor(me?.phone));
    setOpen(next);
  };

  const onSubmit = (values: FormValues) =>
    createPet.mutate({
      name: values.name,
      profileImageFileId: values.profileImageFileId,
      species: values.species,
      breed: values.breed || undefined,
      birthDate: values.birthDate || undefined,
      gender: values.gender || undefined,
      isNeutered: values.isNeutered,
      weightKg:
        values.weightKg === undefined || Number.isNaN(Number(values.weightKg))
          ? undefined
          : Number(values.weightKg),
      guardianPhone: values.guardianPhone || undefined,
      careNote: values.careNote || undefined,
      photoConsent: values.photoConsent,
    });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className='gap-1.5'>
          <Plus className='size-4' />
          아이 등록
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>아이 등록</DialogTitle>
          <p className='text-xs text-muted-foreground'>
            등록 후 목록에서 다니는 유치원에 등원 신청을 할 수 있어요.
          </p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className='flex flex-col gap-4 pt-2'
        >
          <Controller
            control={control}
            name='profileImageFileId'
            render={({ field }) => (
              <AvatarUpload
                value={field.value}
                onChange={field.onChange}
                name={watch("name")}
              />
            )}
          />

          <Field>
            <FieldLabel htmlFor='name'>이름</FieldLabel>
            <Input
              id='name'
              placeholder='예: 초코'
              {...register("name", { required: true })}
            />
          </Field>

          <div className='grid grid-cols-2 gap-3'>
            <Field>
              <FieldLabel htmlFor='species'>종</FieldLabel>
              <Controller
                control={control}
                name='species'
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id='species'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIES_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor='breed'>품종</FieldLabel>
              <Input
                id='breed'
                placeholder='예: 포메라니안'
                {...register("breed")}
              />
            </Field>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <Field>
              <FieldLabel htmlFor='birthDate'>생년월일</FieldLabel>
              <Controller
                control={control}
                name='birthDate'
                render={({ field }) => (
                  <DatePicker
                    id='birthDate'
                    value={field.value}
                    onChange={field.onChange}
                    // 아직 태어나지 않은 아이는 없다.
                    disabled={{ after: new Date() }}
                  />
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor='gender'>성별</FieldLabel>
              <Controller
                control={control}
                name='gender'
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id='gender'>
                      <SelectValue placeholder='선택' />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <Field>
              <FieldLabel htmlFor='weightKg'>체중 (kg)</FieldLabel>
              <Input
                id='weightKg'
                type='number'
                step='0.1'
                {...register("weightKg", { valueAsNumber: true })}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor='isNeutered'>중성화</FieldLabel>
              <Controller
                control={control}
                name='isNeutered'
                render={({ field }) => (
                  <div className='flex h-9 items-center'>
                    <Switch
                      id='isNeutered'
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor='guardianPhone'>보호자 연락처</FieldLabel>
            <Controller
              control={control}
              name='guardianPhone'
              render={({ field }) => (
                <PhoneInput
                  id='guardianPhone'
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <p className='text-xs text-muted-foreground'>
              {me?.phone
                ? "등하원 알림과 알림장을 받을 번호예요. 내 번호가 기본으로 들어가 있고, 다른 분이 받아야 하면 바꿔주세요."
                : "등하원 알림과 알림장을 받을 번호예요. 비워두면 계정에 등록된 번호로 보내드려요."}
            </p>
          </Field>

          <Field>
            <FieldLabel htmlFor='photoConsent'>사진 공개 범위</FieldLabel>
            <Controller
              control={control}
              name='photoConsent'
              render={({ field }) => (
                <>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id='photoConsent'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHOTO_CONSENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className='text-xs text-muted-foreground'>
                    {
                      PHOTO_CONSENT_OPTIONS.find(
                        (option) => option.value === field.value,
                      )?.description
                    }
                  </p>
                </>
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor='careNote'>
              케어 노트 (알러지 · 투약 · 특이사항)
            </FieldLabel>
            <Textarea
              id='careNote'
              rows={3}
              placeholder='예: 닭고기 알러지 있음. 낯선 사람에게 입질 주의.'
              {...register("careNote")}
            />
          </Field>

          <div className='flex justify-end gap-2 pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type='submit' disabled={createPet.isPending}>
              {createPet.isPending ? "등록 중…" : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
