import { Card, CardContent, CardHeader, CardTitle } from "@pawlog/ui";
import type { Pet } from "@pawlog/database";
import { formatPhone } from "@pawlog/shared";

import { calculateAgeLabel, genderLabelMap, PetAvatar, speciesLabelMap } from "@/entities/pet";
import { RequestEditPetDialog } from "@/features/pet/request-edit";
import { EnrollPetControl } from "@/features/pet/enroll-pet";

/**
 * 아이 정보 카드 (widget) — 반려동물 한 마리의 기본 정보를 보여주고
 * 수정 요청 + 매장 등원/해지 기능을 조합한다.
 */
export const PetProfileCard = ({ pet }: { pet: Pet }) => (
  <Card>
    <CardHeader className='flex-row items-center gap-3 space-y-0'>
      <PetAvatar name={pet.name} fileId={pet.profileImageFileId} className='size-12' />
      <div>
        <CardTitle>{pet.name}</CardTitle>
        <p className='text-sm text-muted-foreground'>
          {speciesLabelMap[pet.species] ?? pet.species}
          {pet.breed ? ` · ${pet.breed}` : ""} · {calculateAgeLabel(pet.birthDate)}
        </p>
      </div>
    </CardHeader>
    <CardContent className='flex flex-col gap-2 text-sm'>
      <dl className='grid grid-cols-2 gap-3'>
        <div>
          <dt className='text-xs text-muted-foreground'>성별</dt>
          <dd>{pet.gender ? (genderLabelMap[pet.gender] ?? pet.gender) : "-"}</dd>
        </div>
        <div>
          <dt className='text-xs text-muted-foreground'>중성화</dt>
          <dd>{pet.isNeutered ? "완료" : "미완료"}</dd>
        </div>
        <div>
          <dt className='text-xs text-muted-foreground'>체중</dt>
          <dd>{pet.weightKg ? `${pet.weightKg}kg` : "-"}</dd>
        </div>
        <div>
          <dt className='text-xs text-muted-foreground'>보호자 연락처</dt>
          <dd>{formatPhone(pet.guardianPhone) || "-"}</dd>
        </div>
        <div>
          <dt className='text-xs text-muted-foreground'>비상 연락처</dt>
          <dd>
            {pet.emergencyContactName || pet.emergencyContactPhone
              ? `${pet.emergencyContactName ?? ""} ${pet.emergencyContactPhone ?? ""}`.trim()
              : "-"}
          </dd>
        </div>
      </dl>

      {pet.careNote && (
        <div className='rounded-xl bg-muted/60 p-3'>
          <p className='text-xs font-medium text-muted-foreground'>케어 노트</p>
          <p className='mt-1 whitespace-pre-wrap'>{pet.careNote}</p>
        </div>
      )}

      {/* job-033: 아이는 회원 소유이고 매장 소속은 별개의 조작이다. */}
      <div className='flex flex-wrap items-center justify-between gap-2 border-t pt-3'>
        <EnrollPetControl petId={pet.id} tenantId={pet.tenantId} />
        <RequestEditPetDialog pet={pet} />
      </div>
    </CardContent>
  </Card>
);
