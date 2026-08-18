"use client";

import { useState } from "react";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { Button, Spinner } from "@pawlog/ui";

import { EmptyState } from "@/shared/ui";
import { usePets } from "@/entities/pet";
import { ReservationCalendar } from "@/features/pet/reserve-attendance";

/**
 * 등원 예약 (widget, job-060).
 *
 * 아이를 고르고 그 아이의 예약 달력을 띄운다. 달력 자체(운영일 판정·잔액·예약/취소)는
 * feature 가 통째로 들고 있고, 이 위젯은 **어느 아이인가**만 정한다.
 *
 * ⚠️ 달력을 아이별로 두는 이유: 이용권 잔액이 아이 단위이기 때문이다(job-045). 형제견을
 * 한 화면에서 같이 고르게 하면 "초코 10회권"과 "두부 10회권" 중 어느 쪽이 깎이는지
 * 화면이 말할 수 없다.
 */
export const ReservationBoard = () => {
  const { data: pets, isLoading } = usePets();
  const [petId, setPetId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className='flex justify-center py-10'>
        <Spinner className='size-8 text-primary' />
      </div>
    );
  }

  if (!pets || pets.length === 0) {
    return (
      <EmptyState
        icon={PawPrint}
        title='등록된 아이가 없어요'
        description='아이를 등록하고 유치원에 가입 신청하면 등원 예약을 할 수 있습니다.'
        action={
          <Button asChild>
            <Link href='/pet'>아이 등록하기</Link>
          </Button>
        }
      />
    );
  }

  // 아이가 하나면 고를 것이 없다 — 칩 줄을 띄우면 누를 수 없는 버튼 한 개만 남는다.
  const selected = petId ?? pets[0]!.id;

  return (
    <div className='flex flex-col gap-6'>
      {pets.length > 1 && (
        <div className='flex flex-wrap gap-2'>
          {pets.map((pet) => (
            <Button
              key={pet.id}
              type='button'
              variant={selected === pet.id ? "default" : "outline"}
              className='rounded-full'
              onClick={() => setPetId(pet.id)}
            >
              {pet.name}
            </Button>
          ))}
        </div>
      )}

      {/* key 로 아이를 갈아끼운다 — 달력 안의 "아직 보내지 않은 선택"이 아이를 바꿀 때
          남아 있으면, 초코를 고르려다 두부의 날짜를 예약하게 된다. */}
      <ReservationCalendar key={selected} petId={selected} />
    </div>
  );
};
