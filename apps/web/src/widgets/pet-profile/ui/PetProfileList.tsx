"use client";

import { Spinner } from "@pawlog/ui";

import { usePets } from "@/entities/pet";
import { CreateMyPetDialog } from "@/features/pet/create-my-pet";

import { PetProfileCard } from "./PetProfileCard";

/** 아이 정보 목록 (widget) — 내 반려동물 전체를 조회해 프로필 카드로 보여준다. */
export const PetProfileList = () => {
  const { data: pets, isLoading } = usePets();

  if (isLoading) {
    return (
      <div className='flex justify-center py-5'>
        <Spinner className='size-6' />
      </div>
    );
  }

  // 빈 상태에서 다음 행동을 바로 할 수 있어야 한다 — 예전에는 "없어요"만 띄우고 등록
  // 버튼이 어디에도 없어서, 보호자는 매장이 대신 등록해 줄 때까지 아무것도 할 수 없었다.
  if (!pets || pets.length === 0) {
    return (
      <div className='flex flex-col items-center gap-3 py-12'>
        <p className='text-sm text-muted-foreground'>등록된 아이가 없어요.</p>
        <CreateMyPetDialog />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      {pets.map((pet) => (
        <PetProfileCard key={pet.id} pet={pet} />
      ))}
    </div>
  );
};
