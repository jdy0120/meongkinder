"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Check, Plus, Search, UserPlus } from "lucide-react";
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
  Spinner,
  Textarea,
} from "@pawlog/ui";
import { PET_INTAKE_GUARDIAN_STATUS } from "@pawlog/shared";
import type { PetIntakeCandidatePet } from "@pawlog/shared";

import { SPECIES_OPTIONS, calculateAgeLabel } from "@/entities/pet";
import { AvatarUpload } from "@/entities/file";
import { DatePicker, PhoneInput } from "@/shared/ui";
import { PHOTO_CONSENT_OPTIONS } from "@/entities/feed";

import { useIntakePet, usePetIntakeLookup } from "../model/usePetIntake";

interface FormValues {
  name: string;
  /** 업로드된 임시 파일 id. 서버가 저장 직전 영구 저장소로 옮긴다 (job-053). */
  profileImageFileId?: string;
  species: string;
  breed: string;
  birthDate: string;
  guardianName: string;
  careNote: string;
  photoConsent: string;
}

const DEFAULT_VALUES: FormValues = {
  name: "",
  profileImageFileId: undefined,
  species: "DOG",
  breed: "",
  birthDate: "",
  guardianName: "",
  careNote: "",
  photoConsent: "CLASS",
};

/** 보호자 상태별 안내 문구. 원장이 "지금 무슨 상황인지"를 한 줄로 알 수 있어야 한다. */
const STATUS_NOTICE: Record<string, string> = {
  [PET_INTAKE_GUARDIAN_STATUS.MEMBER_OF_TENANT]:
    "우리 매장 구성원입니다. 이미 등록된 아이를 고르거나 새로 등록할 수 있어요.",
  [PET_INTAKE_GUARDIAN_STATUS.MEMBER_ELSEWHERE]:
    "가입한 회원이지만 아직 우리 매장 구성원이 아닙니다. 아이를 등록하면 구성원으로 추가됩니다.",
  [PET_INTAKE_GUARDIAN_STATUS.NOT_REGISTERED]:
    "아직 가입하지 않은 보호자입니다. 계정 없이 등록되며, 알림장과 등하원 알림은 이 번호로 발송됩니다.",
};

/**
 * 원생 등록 다이얼로그 — 단일 진입점 (job-040).
 *
 * ## 왜 전화번호부터 받는가
 *
 * 예전 화면은 보호자 계정을 검색해서 고르게 했다. 그런데 원장이 현장에서 아는 것은
 * 전화번호뿐이고, 그 보호자가 가입했는지는 모른다. 검색이 빈손이면 "가입을 안 했나 보네"
 * 하고 창을 닫은 뒤 구성원 초대 메뉴로 가서 처음부터 다시 입력해야 했다.
 *
 * 지금은 번호를 넣고 조회하면 서버가 세 갈래 중 어디인지 알려주고, 원장은 그 결과 위에서
 * 이어서 진행한다. 어느 갈래든 마지막 동작은 "등록" 하나다.
 */
export const PetIntakeDialog = () => {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const lookup = usePetIntakeLookup(phone, searched);
  const { register, handleSubmit, control, reset, watch } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const close = () => {
    setOpen(false);
    setPhone("");
    setSearched(false);
    setSelectedPetId(null);
    setCreatingNew(false);
    reset(DEFAULT_VALUES);
  };

  const intake = useIntakePet(close);

  const result = lookup.data;
  const isMember =
    result?.status === PET_INTAKE_GUARDIAN_STATUS.MEMBER_OF_TENANT;
  // 미가입 보호자는 고를 아이가 없으므로 곧바로 입력 폼을 연다.
  const showForm =
    creatingNew ||
    (result != null && result.status !== PET_INTAKE_GUARDIAN_STATUS.MEMBER_OF_TENANT);

  const search = () => {
    setSelectedPetId(null);
    setCreatingNew(false);
    setSearched(true);
  };

  const enrollSelected = () => {
    if (!selectedPetId) return;
    intake.mutate({ phone, petId: selectedPetId });
  };

  const onSubmit = (values: FormValues) =>
    intake.mutate({
      phone,
      guardianName: values.guardianName || undefined,
      pet: {
        name: values.name,
        profileImageFileId: values.profileImageFileId,
        species: values.species,
        breed: values.breed || undefined,
        birthDate: values.birthDate || undefined,
        guardianName: values.guardianName || undefined,
        careNote: values.careNote || undefined,
        photoConsent: values.photoConsent,
      },
    });

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button className='gap-1.5'>
          <Plus className='size-4' />
          원생 등록
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>원생 등록</DialogTitle>
          <p className='text-xs text-muted-foreground'>
            보호자 전화번호로 시작하세요. 가입 여부는 확인하지 않으셔도 됩니다.
          </p>
        </DialogHeader>

        <div className='flex flex-col gap-4 pt-2'>
          {/* ── 1단계: 전화번호 조회 ────────────────────────────── */}
          <Field>
            <FieldLabel htmlFor='intake-phone'>보호자 전화번호</FieldLabel>
            <div className='flex gap-2'>
              <PhoneInput
                id='intake-phone'
                value={phone}
                onChange={(digits) => {
                  setPhone(digits);
                  setSearched(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    search();
                  }
                }}
              />
              <Button
                type='button'
                variant='outline'
                className='shrink-0 gap-1.5'
                onClick={search}
                disabled={phone.replace(/[^0-9]/g, "").length < 10}
              >
                <Search className='size-4' />
                조회
              </Button>
            </div>
          </Field>

          {lookup.isFetching && (
            <div className='flex justify-center py-4'>
              <Spinner className='size-5' />
            </div>
          )}

          {/* ── 2단계: 조회 결과 ────────────────────────────────── */}
          {result && !lookup.isFetching && (
            <div className='rounded-xl border bg-muted/40 p-3 text-sm'>
              {result.guardian && (
                <p className='font-medium'>{result.guardian.nickname}</p>
              )}
              <p className='text-xs text-muted-foreground'>
                {STATUS_NOTICE[result.status]}
              </p>
            </div>
          )}

          {/* 이미 등록해 둔 아이 고르기 (우리 매장 구성원일 때만 목록이 내려온다) */}
          {isMember && !creatingNew && !lookup.isFetching && (
            <div className='flex flex-col gap-2'>
              {result!.pets.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  이 보호자가 등록한 아이가 없습니다. 새로 등록해주세요.
                </p>
              ) : (
                result!.pets.map((pet: PetIntakeCandidatePet) => {
                  const selected = selectedPetId === pet.id;
                  return (
                    <button
                      key={pet.id}
                      type='button'
                      disabled={pet.enrolled}
                      onClick={() => setSelectedPetId(pet.id)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                        pet.enrolled
                          ? "cursor-not-allowed opacity-50"
                          : selected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/60"
                      }`}
                    >
                      <span>
                        <span className='text-sm font-medium'>{pet.name}</span>
                        <span className='ml-2 text-xs text-muted-foreground'>
                          {pet.breed ?? "품종 미상"} ·{" "}
                          {calculateAgeLabel(pet.birthDate)}
                        </span>
                      </span>
                      {pet.enrolled ? (
                        <span className='text-xs text-muted-foreground'>
                          이미 등록됨
                        </span>
                      ) : (
                        selected && <Check className='size-4 text-primary' />
                      )}
                    </button>
                  );
                })
              )}

              <div className='flex gap-2 pt-1'>
                <Button
                  type='button'
                  variant='outline'
                  className='flex-1 gap-1.5'
                  onClick={() => setCreatingNew(true)}
                >
                  <UserPlus className='size-4' />새 아이 등록
                </Button>
                <Button
                  type='button'
                  className='flex-1'
                  disabled={!selectedPetId || intake.isPending}
                  onClick={enrollSelected}
                >
                  {intake.isPending ? "등록 중…" : "선택한 아이 등록"}
                </Button>
              </div>
            </div>
          )}

          {/* ── 3단계: 새 아이 입력 ─────────────────────────────── */}
          {showForm && !lookup.isFetching && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className='flex flex-col gap-4 border-t pt-4'
            >
              {/* job-053: 사진을 맨 위에 둔다. 등록은 보호자를 앞에 세워 두고 하는
                  작업이라, 아이를 눈앞에서 찍는 것이 가장 자연스러운 첫 동작이다. */}
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
                <FieldLabel htmlFor='intake-name'>아이 이름</FieldLabel>
                <Input
                  id='intake-name'
                  placeholder='예: 초코'
                  {...register("name", { required: true })}
                />
              </Field>

              <div className='grid grid-cols-2 gap-3'>
                <Field>
                  <FieldLabel htmlFor='intake-species'>종</FieldLabel>
                  <Controller
                    control={control}
                    name='species'
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id='intake-species'>
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
                  <FieldLabel htmlFor='intake-breed'>품종</FieldLabel>
                  <Input id='intake-breed' {...register("breed")} />
                </Field>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <Field>
                  <FieldLabel htmlFor='intake-birth'>생년월일</FieldLabel>
                  <Controller
                    control={control}
                    name='birthDate'
                    render={({ field }) => (
                      <DatePicker
                        id='intake-birth'
                        value={field.value}
                        onChange={field.onChange}
                        // 아직 태어나지 않은 아이는 없다.
                        disabled={{ after: new Date() }}
                      />
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor='intake-guardian'>보호자 이름</FieldLabel>
                  <Input id='intake-guardian' {...register("guardianName")} />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor='intake-consent'>사진 공개 범위</FieldLabel>
                <Controller
                  control={control}
                  name='photoConsent'
                  render={({ field }) => (
                    <>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id='intake-consent'>
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
                        보호자에게 확인받은 범위로 설정해주세요. 나중에 보호자가
                        직접 바꿀 수 있습니다.
                      </p>
                    </>
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor='intake-note'>
                  케어 노트 (알러지 · 투약 · 특이사항)
                </FieldLabel>
                <Textarea
                  id='intake-note'
                  rows={3}
                  {...register("careNote")}
                  placeholder='예: 닭고기 알러지 있음. 낯선 사람에게 입질 주의.'
                />
              </Field>

              <div className='flex justify-end gap-2'>
                <Button type='button' variant='outline' onClick={close}>
                  취소
                </Button>
                <Button type='submit' disabled={intake.isPending}>
                  {intake.isPending ? "등록 중…" : "등록"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
