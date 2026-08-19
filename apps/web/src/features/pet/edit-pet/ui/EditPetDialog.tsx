"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pencil } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
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
  Switch,
  Textarea,
} from "@pawlog/ui";
import {
  formatPhone,
  parseVaccinations,
  PICKUP_METHOD,
  VACCINATION_TYPES,
  type PetWithOwner,
  type VaccinationRecord,
} from "@pawlog/shared";

import { GENDER_OPTIONS, SPECIES_OPTIONS, vaccinationLabel } from "@/entities/pet";
import { PHOTO_CONSENT_OPTIONS } from "@/entities/feed";
import { AvatarUpload } from "@/entities/file";
import { DatePicker, PhoneInput } from "@/shared/ui";

import { useUpdatePet } from "../model/useUpdatePet";

interface FormValues {
  name: string;
  /** 업로드된 파일 id. 새 사진이면 임시 파일이고, 서버가 저장 직전 옮긴다 (job-053). */
  profileImageFileId?: string;
  species: string;
  breed: string;
  birthDate: string;
  gender: string;
  isNeutered: boolean;
  weightKg?: number;
  guardianName: string;
  guardianPhone: string;
  careNote: string;
  photoConsent: string;

  // 안전 정보 (job-052)
  allergies: string;
  temperaments: string;
  marksIndoors: boolean;
  mountingBehavior: boolean;
  hasBiteHistory: boolean;
  adaptationStartedAt: string;
  /** 백신 종류 → 만료일. 비어 있으면 "기록 없음"이다. */
  vaccinations: Record<string, string>;

  // 픽업 (job-052)
  pickupTime: string;
  pickupMethod: string;
  shuttleNumber?: number;
}

const toDateInputValue = (value?: string | Date | null) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

/**
 * 쉼표로 구분한 문자열 ↔ 배열.
 *
 * 태그 입력 UI 를 만들지 않은 이유: 이 화면은 원장이 아이 하나를 열어 한 번 채우고 마는
 * 자리라 입력 빈도가 낮고, 태그 컴포넌트는 젖은 손에서 **삭제 X 버튼이 너무 작아진다**
 * (§2.3 터치 타겟 64px). 쉼표는 한글 키보드에서 바로 나온다.
 */
const splitList = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

interface EditPetDialogProps {
  pet: PetWithOwner;
}

/**
 * 반려동물 상세/수정 다이얼로그 (feature ui).
 *
 * job-052: **안전 정보를 여기서 채운다.** 알러지·성향·마킹·접종은 예전에 케어 노트 한 칸에
 * 문장으로 들어갔는데, 그러면 카드 표면에 올릴 수도 필터를 걸 수도 없었다. 기존 문장을
 * 자동 파싱해 옮기지 않은 이유는 **잘못 파싱한 알러지가 없는 것보다 위험하기** 때문이다 —
 * 원장이 아이를 열어 확인하며 채우는 것이 맞고, 그때까지 빈 값이 정직한 상태다.
 */
export const EditPetDialog = ({ pet }: EditPetDialogProps) => {
  const [open, setOpen] = useState(false);

  const existingVaccinations = parseVaccinations(pet.vaccinations);

  const { register, handleSubmit, control } = useForm<FormValues>({
    defaultValues: {
      name: pet.name,
      profileImageFileId: pet.profileImageFileId ?? undefined,
      species: pet.species,
      breed: pet.breed ?? "",
      birthDate: toDateInputValue(pet.birthDate),
      gender: pet.gender ?? "",
      isNeutered: pet.isNeutered ?? false,
      weightKg: pet.weightKg ?? undefined,
      guardianName: pet.guardianName ?? "",
      guardianPhone: pet.guardianPhone ?? "",
      careNote: pet.careNote ?? "",
      photoConsent: pet.photoConsent,

      allergies: pet.allergies.join(", "),
      temperaments: pet.temperaments.join(", "),
      marksIndoors: pet.marksIndoors ?? false,
      mountingBehavior: pet.mountingBehavior ?? false,
      hasBiteHistory: pet.hasBiteHistory ?? false,
      adaptationStartedAt: toDateInputValue(pet.adaptationStartedAt),
      vaccinations: Object.fromEntries(
        VACCINATION_TYPES.map((type) => [
          type,
          existingVaccinations.find((record) => record.type === type)
            ?.expiresAt ?? "",
        ]),
      ),

      pickupTime: pet.pickupTime ?? "",
      pickupMethod: pet.pickupMethod ?? "",
      shuttleNumber: pet.shuttleNumber ?? undefined,
    },
  });
  const updatePet = useUpdatePet(() => setOpen(false));

  const onSubmit = (values: FormValues) => {
    // 만료일을 비운 종류는 "기록 없음"이므로 아예 보내지 않는다 — 빈 문자열을 보내면
    // 서버 검증(ISO 8601)에 걸린다.
    const vaccinations: VaccinationRecord[] = Object.entries(
      values.vaccinations,
    )
      .filter(([, expiresAt]) => Boolean(expiresAt))
      .map(([type, expiresAt]) => ({ type, expiresAt }));

    updatePet.mutate({
      id: pet.id,
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
      guardianName: values.guardianName || undefined,
      guardianPhone: values.guardianPhone || undefined,
      careNote: values.careNote || undefined,
      photoConsent: values.photoConsent,

      // 빈 배열도 그대로 보낸다 — "알러지를 지웠다"를 "안 보냈다"와 구분해야 한다.
      allergies: splitList(values.allergies),
      temperaments: splitList(values.temperaments),
      marksIndoors: values.marksIndoors,
      mountingBehavior: values.mountingBehavior,
      hasBiteHistory: values.hasBiteHistory,
      adaptationStartedAt: values.adaptationStartedAt || undefined,
      vaccinations,

      pickupTime: values.pickupTime || undefined,
      pickupMethod: values.pickupMethod || undefined,
      shuttleNumber:
        values.shuttleNumber === undefined ||
        Number.isNaN(Number(values.shuttleNumber))
          ? undefined
          : Number(values.shuttleNumber),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' className='flex-1'>
          <Pencil />
          정보 수정
        </Button>
      </DialogTrigger>

      <DialogContent className='max-h-[85vh] overflow-x-hidden overflow-y-auto rounded-2xl sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='text-title'>{pet.name}</DialogTitle>
          <p className='text-label text-muted-foreground'>
            {/* 계정 없이 등록된 원생(job-040)은 연락처만 있다. */}
            {pet.user
              ? `보호자 계정: ${pet.user.nickname} (${pet.user.email})`
              : `보호자 계정 미연결 · ${formatPhone(pet.guardianPhone) || "연락처 없음"}`}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-6 pt-2'>
          {/* ── 안전 정보 ────────────────────────────────────────────────
              **맨 위에 둔다.** 이 다이얼로그를 여는 이유의 대부분이 여기고, 아래로
              내리면 이름·체중을 지나쳐 스크롤해야 해서 결국 안 채우게 된다. */}
          <section className='space-y-4'>
            <h3 className='text-label font-semibold text-muted-foreground'>
              안전 정보
            </h3>

            <div className='space-y-2'>
              <Label htmlFor='pet-allergies'>알러지</Label>
              <Input
                id='pet-allergies'
                {...register("allergies")}
                placeholder='닭고기, 소고기'
              />
              <p className='text-label text-muted-foreground'>
                쉼표로 구분합니다. 급여 전에 봐야 하므로 카드 앞면에 그대로 표시됩니다.
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='pet-temperaments'>성향</Label>
              <Input
                id='pet-temperaments'
                {...register("temperaments")}
                placeholder='대형견 무서워함, 물 싫어함'
              />
              <p className='break-keep text-label text-muted-foreground'>
                <strong>형용사가 아니라 상황</strong>으로 적어 주세요. &lsquo;소심함&rsquo;이
                아니라 &lsquo;대형견 무서워함&rsquo; — 합사 그룹을 나눌 때 그대로 쓸 수 있어야 합니다.
              </p>
            </div>

            <ToggleRow
              control={control}
              name='hasBiteHistory'
              label='공격/입질 이력'
              hint='켜면 카드 테두리가 빨갛게 표시되고, 합사 전에 눈에 띕니다.'
            />
            <ToggleRow
              control={control}
              name='marksIndoors'
              label='실내 마킹'
            />
            <ToggleRow
              control={control}
              name='mountingBehavior'
              label='마운팅'
            />

            <div className='space-y-2'>
              {/*
                여기서 `<Label>` 은 틀린 태그다 — 이 제목이 가리키는 것은 컨트롤 하나가
                아니라 접종 4종의 날짜 칸 전체인데, `<label htmlFor>` 는 **하나만**
                가리킬 수 있다. 그래서 제목은 그룹 이름(`aria-labelledby`)으로 올리고,
                각 칸의 이름은 그 옆의 종류 이름이 맡는다. 이렇게 해야 스크린리더가
                "예방접종 만료일 그룹, 광견병, 날짜 선택" 순으로 읽는다 — 예전에는
                네 칸이 전부 이름 없는 버튼으로만 읽혔다.
              */}
              <span
                id='pet-vaccinations-label'
                className='text-body font-medium'
              >
                예방접종 만료일
              </span>
              <div
                role='group'
                aria-labelledby='pet-vaccinations-label'
                className='grid grid-cols-2 gap-3'
              >
                {VACCINATION_TYPES.map((type) => (
                  <div key={type} className='space-y-1.5'>
                    <Label
                      htmlFor={`pet-vaccination-${type}`}
                      className='text-label text-muted-foreground'
                    >
                      {vaccinationLabel(type)}
                    </Label>
                    <Controller
                      control={control}
                      name={`vaccinations.${type}` as const}
                      render={({ field }) => (
                        <DatePicker
                          id={`pet-vaccination-${type}`}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder='기록 없음'
                          /* 만료일은 미래도 과거도 유효하다 — 아직 유효한 접종과 이미
                             지난 접종을 둘 다 기록해야 `resolveVaccination` 이 조회
                             시점에 상태를 계산할 수 있다. */
                        />
                      )}
                    />
                  </div>
                ))}
              </div>
              <p className='text-label text-muted-foreground'>
                비워 두면 &lsquo;기록 없음&rsquo;으로 표시됩니다 — 확인한 적 없다는 뜻이라
                &lsquo;정상&rsquo;과 구분됩니다.
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='pet-adaptation-started-at'>적응 기간 시작일</Label>
              <Controller
                control={control}
                name='adaptationStartedAt'
                render={({ field }) => (
                  <DatePicker
                    id='pet-adaptation-started-at'
                    value={field.value}
                    onChange={field.onChange}
                    placeholder='없음'
                  />
                )}
              />
              <p className='text-label text-muted-foreground'>
                넣으면 2주간 &lsquo;적응 N일차&rsquo; 배지가 붙습니다.
              </p>
            </div>
          </section>

          {/* ── 픽업 ───────────────────────────────────────────────────── */}
          <section className='space-y-4'>
            <h3 className='text-label font-semibold text-muted-foreground'>
              픽업
            </h3>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='pet-pickup-time'>픽업 시각</Label>
                <Input
                  id='pet-pickup-time'
                  type='time'
                  {...register("pickupTime")}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='pet-pickup-method'>픽업 수단</Label>
                <Controller
                  name='pickupMethod'
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id='pet-pickup-method' className='w-full'>
                        <SelectValue placeholder='선택' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PICKUP_METHOD.GUARDIAN}>
                          보호자 직접
                        </SelectItem>
                        <SelectItem value={PICKUP_METHOD.SHUTTLE}>
                          셔틀
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='pet-shuttle-number'>셔틀 호차</Label>
              <Input
                id='pet-shuttle-number'
                type='number'
                min={1}
                {...register("shuttleNumber", { valueAsNumber: true })}
              />
              <p className='text-label text-muted-foreground'>
                원생 목록은 픽업 시각 순으로 정렬됩니다 — 오후 작업 순서표가 됩니다.
              </p>
            </div>
          </section>

          {/* ── 기본 정보 ──────────────────────────────────────────────── */}
          <section className='space-y-4'>
            <h3 className='text-label font-semibold text-muted-foreground'>
              기본 정보
            </h3>

            <Controller
              control={control}
              name='profileImageFileId'
              render={({ field }) => (
                <AvatarUpload
                  value={field.value}
                  onChange={field.onChange}
                  name={pet.name}
                />
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='pet-name'>이름</Label>
                <Input id='pet-name' {...register("name", { required: true })} />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='pet-species'>종</Label>
                <Controller
                  name='species'
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id='pet-species' className='w-full'>
                        <SelectValue placeholder='종 선택' />
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
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='pet-breed'>견종/품종</Label>
                <Input id='pet-breed' {...register("breed")} />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='pet-gender'>성별</Label>
                <Controller
                  name='gender'
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id='pet-gender' className='w-full'>
                        <SelectValue placeholder='성별 선택' />
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
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='pet-birth-date'>생년월일</Label>
                <Controller
                  control={control}
                  name='birthDate'
                  render={({ field }) => (
                    <DatePicker
                      id='pet-birth-date'
                      value={field.value}
                      onChange={field.onChange}
                      // 아직 태어나지 않은 아이는 없다.
                      disabled={{ after: new Date() }}
                    />
                  )}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='pet-weight-kg'>체중 (kg)</Label>
                <Input
                  id='pet-weight-kg'
                  type='number'
                  step='0.1'
                  {...register("weightKg", { valueAsNumber: true })}
                />
              </div>
            </div>

            <ToggleRow
              control={control}
              name='isNeutered'
              label='중성화 완료'
            />

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='pet-guardian-name'>보호자 이름</Label>
                <Input id='pet-guardian-name' {...register("guardianName")} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='pet-guardian-phone'>보호자 연락처</Label>
                <Controller
                  control={control}
                  name='guardianPhone'
                  render={({ field }) => (
                    <PhoneInput
                      id='pet-guardian-phone'
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='pet-care-note'>케어 노트</Label>
              <Textarea
                id='pet-care-note'
                rows={3}
                {...register("careNote")}
                placeholder='투약 방법, 보호자 당부처럼 위 항목에 담기지 않는 내용만 적어 주세요.'
              />
              <p className='text-label text-muted-foreground'>
                알러지·성향·접종은 위 &lsquo;안전 정보&rsquo;에 넣어야 카드에 표시되고
                필터가 걸립니다.
              </p>
            </div>

            {/* 초상권 동의 범위 — 단체 사진에 남의 아이가 함께 찍히는 구조라 아이별로 필요하다.
                나중에 붙이면 이미 쌓인 사진의 노출 범위를 소급 판정할 수 없다. */}
            <div className='space-y-2'>
              <Label htmlFor='pet-photo-consent'>초상권 동의 범위</Label>
              <Controller
                name='photoConsent'
                control={control}
                render={({ field }) => (
                  <>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id='pet-photo-consent' className='w-full'>
                        <SelectValue placeholder='동의 범위 선택' />
                      </SelectTrigger>
                      <SelectContent>
                        {PHOTO_CONSENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* 설명은 Controller 의 field.value 로 그린다. watch() 로 읽으면 React Compiler 가
                        메모이제이션을 통째로 포기한다(react-hooks/incompatible-library). */}
                    <p className='text-label text-muted-foreground'>
                      {
                        PHOTO_CONSENT_OPTIONS.find(
                          (option) => option.value === field.value,
                        )?.description
                      }
                    </p>
                  </>
                )}
              />
            </div>
          </section>

          <div className='flex justify-end gap-3 pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type='submit' disabled={updatePet.isPending}>
              {updatePet.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/** 라벨 + 스위치 한 줄. 스위치가 여섯 개라 매번 같은 마크업을 적으면 갈라진다. */
const ToggleRow = ({
  control,
  name,
  label,
  hint,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: "marksIndoors" | "mountingBehavior" | "hasBiteHistory" | "isNeutered";
  label: string;
  hint?: string;
}) => (
  /*
   * 스위치는 **글자를 하나도 안 들고 있는 컨트롤**이다. 이름을 붙여 주지 않으면
   * 스크린리더가 "스위치, 꺼짐"까지만 읽고 무엇에 대한 스위치인지는 말하지 않는다 —
   * 물림 이력·마운팅처럼 안전에 직결되는 항목이 전부 그 상태였다.
   *
   * `htmlFor` 로 이름을, `aria-describedby` 로 부연을 잇는다. 둘을 나누는 이유는
   * 목록에서 훑을 때는 이름만 읽히고 초점이 닿았을 때 설명이 따라와야 하기 때문이다.
   * 라벨을 붙인 부수효과로 **글자를 눌러도 토글된다** — 젖은 손으로 쓰는 화면에서
   * 히트 영역이 스위치 하나에서 행 전체로 넓어진다.
   */
  <div className='flex items-center justify-between gap-4 border-y py-3'>
    <div className='min-w-0'>
      <Label htmlFor={`pet-${name}`} className='text-body font-semibold'>
        {label}
      </Label>
      {hint && (
        <p
          id={`pet-${name}-hint`}
          className='break-keep text-label text-muted-foreground'
        >
          {hint}
        </p>
      )}
    </div>
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Switch
          id={`pet-${name}`}
          aria-describedby={hint ? `pet-${name}-hint` : undefined}
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      )}
    />
  </div>
);
