"use client";

import type { ReactNode } from "react";
import { formatPhone, type PetWithOwner } from "@pawlog/shared";

import { BottomSheet } from "@/shared/ui";
import {
  AdaptationBadge,
  AllergyBadge,
  calculateAgeLabel,
  formatPickupMethod,
  formatPickupTime,
  genderLabelMap,
  MarkingBadges,
  NeuteredBadge,
  PassBalanceBadge,
  resolvePetSafety,
  speciesLabelMap,
  TemperamentBadges,
  vaccinationLabel,
  VaccinationBadge,
} from "@/entities/pet";
import { EditPetDialog } from "@/features/pet/edit-pet";
import { PetScheduleDialog } from "@/features/pet/edit-schedule";
import { SellTicketDialog } from "@/features/subscription/sell-ticket";

/**
 * 원생 상세 (design-system.md §3.2).
 *
 * **페이지가 아니라 시트다.** 등하원 시간대에 원장은 목록을 위아래로 훑는데, 상세가
 * 페이지 이동이면 뒤로 나올 때마다 스크롤이 맨 위로 돌아가 20번째 아이를 매번 다시 찾는다.
 *
 * 최상단은 **보호자 전화 걸기**다(`BottomSheet` 가 그린다) — 상세를 여는 가장 잦은 목적이
 * "지금 보호자에게 전화"이기 때문이다(미도착·구토·다툼).
 *
 * 여기 담기는 것은 카드에서 **내려보낸** 조회용 정보다: 체중·생일·성별·보호자 계정·
 * 비상 연락처·픽업 담당자. 사고 예방용(알러지·공격성·접종 만료)은 카드 표면에 남아 있고
 * 여기서는 상세를 덧붙이기만 한다.
 */
export const PetDetailSheet = ({
  pet,
  open,
  onOpenChange,
}: {
  pet: PetWithOwner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  if (!pet) return null;

  const safety = resolvePetSafety(pet);
  const method = formatPickupMethod(pet.pickupMethod, pet.shuttleNumber);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={pet.name}
      description={[
        pet.breed || speciesLabelMap[pet.species] || pet.species,
        calculateAgeLabel(pet.birthDate),
        pet.gender ? genderLabelMap[pet.gender] : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      // 시트 최상단의 '보호자에게 전화' 버튼. `guardianPhone` 만 보면 계정에만 번호가 있는
      // 아이는 버튼이 사라져, 정작 급할 때 앱 밖에서 번호를 찾아야 한다.
      guardianPhone={pet.contactPhone}
      footer={
        // job-053: 등원 스케줄을 여기 두는 이유 — 원장이 "이 아이 요일 바꿔야지"를
        // 떠올리는 순간은 목록을 훑다가 카드를 열었을 때다. 별도 화면으로 빼면
        // 그 순간과 조작 사이에 화면 이동이 끼어 대개 잊는다.
        <div className='flex flex-col gap-3'>
          <PetScheduleDialog petId={pet.id} petName={pet.name} />
          <div className='flex gap-3'>
            <EditPetDialog pet={pet} />
            <SellTicketDialog petId={pet.id} petName={pet.name} />
          </div>
        </div>
      }
    >
      <Section title='안전 정보'>
        <div className='flex flex-wrap gap-2'>
          <VaccinationBadge safety={safety} />
          <AllergyBadge allergies={pet.allergies} />
          <TemperamentBadges
            temperaments={pet.temperaments}
            hasBiteHistory={pet.hasBiteHistory}
          />
          <MarkingBadges
            marksIndoors={pet.marksIndoors}
            mountingBehavior={pet.mountingBehavior}
          />
          <AdaptationBadge day={safety.adaptationDay} />
          <NeuteredBadge isNeutered={pet.isNeutered} />
          <PassBalanceBadge remaining={pet.passRemaining} />
        </div>

        {safety.vaccinations.length > 0 && (
          <dl className='space-y-1.5'>
            {safety.vaccinations.map((vaccination) => (
              <Row
                key={vaccination.type}
                label={vaccinationLabel(vaccination.type)}
                value={`${vaccination.expiresAt} 까지${
                  vaccination.daysLeft < 0
                    ? ` (${-vaccination.daysLeft}일 지남)`
                    : ` (D-${vaccination.daysLeft})`
                }`}
              />
            ))}
          </dl>
        )}

        {pet.careNote && (
          <p className='break-keep rounded-xl bg-muted/40 p-4 text-body'>
            {pet.careNote}
          </p>
        )}
      </Section>

      <Section title='기본 정보'>
        <dl className='space-y-1.5'>
          <Row label='체중' value={pet.weightKg ? `${pet.weightKg}kg` : "-"} />
          <Row
            label='생일'
            value={
              pet.birthDate
                ? new Date(pet.birthDate).toLocaleDateString("ko-KR")
                : "-"
            }
          />
          <Row
            label='픽업'
            value={`${formatPickupTime(pet.pickupTime)}${method ? ` · ${method}` : ""}`}
          />
        </dl>
      </Section>

      <Section title='보호자'>
        <dl className='space-y-1.5'>
          {/* job-040: 계정 미연결 원생은 빈칸으로 두지 않는다 — 이 아이들이 곧 가입 유도
              대상이고, 원장이 "왜 이 보호자는 앱에서 안 보이지"를 여기서 알아야 한다. */}
          <Row
            label='계정'
            value={
              pet.user
                ? `${pet.user.nickname} (${pet.user.email})`
                : "계정 미연결 — 가입 시 자동으로 연결됩니다"
            }
          />
          <Row label='이름' value={pet.guardianName || "-"} />
          <Row
            label='연락처'
            value={
              formatPhone(pet.contactPhone) ||
              // 알림톡도 못 가는 상태다 — 원장이 직접 받아 적어야 한다는 뜻.
              "등록된 번호 없음"
            }
          />
          <Row
            label='비상 연락처'
            value={
              pet.emergencyContactPhone
                ? `${pet.emergencyContactName ?? ""} ${formatPhone(pet.emergencyContactPhone)}`.trim()
                : "-"
            }
          />
        </dl>
      </Section>
    </BottomSheet>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className='space-y-3'>
    <h3 className='text-label font-semibold text-muted-foreground'>{title}</h3>
    {children}
  </section>
);

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className='flex items-start justify-between gap-4'>
    <dt className='shrink-0 text-label text-muted-foreground'>{label}</dt>
    <dd className='min-w-0 break-keep text-right text-body'>{value}</dd>
  </div>
);
