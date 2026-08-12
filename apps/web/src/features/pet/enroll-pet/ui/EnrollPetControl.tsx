"use client";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pawlog/ui";
import { MEMBERSHIP_STATUS } from "@pawlog/shared";

import { useMyMemberships } from "@/entities/membership";
import { useEnrollPet, useUnenrollPet } from "../model/useEnrollPet";

interface EnrollPetControlProps {
  petId: string;
  /** 현재 등원 중인 매장. null 이면 아직 어느 매장에도 등록되지 않은 개인 아이. */
  tenantId: string | null;
}

/**
 * 등원/해지 컨트롤 (feature ui).
 *
 * 등록 가능한 곳은 "내가 ACTIVE 로 소속된 매장"뿐이다. 승인 대기 중인 매장은
 * 목록에서 제외해, 고를 수 있는데 서버에서 거절당하는 상황을 만들지 않는다.
 */
export const EnrollPetControl = ({ petId, tenantId }: EnrollPetControlProps) => {
  const { data: memberships } = useMyMemberships();
  const enroll = useEnrollPet();
  const unenroll = useUnenrollPet();

  const enrollable = (memberships ?? []).filter(
    (m) => m.status === MEMBERSHIP_STATUS.ACTIVE,
  );

  if (tenantId) {
    const current = enrollable.find((m) => m.tenantId === tenantId);
    return (
      <div className='flex items-center gap-2'>
        <span className='text-sm text-muted-foreground'>
          {current?.tenant.name ?? "등원 중"}
        </span>
        <Button
         
          variant='outline'
          disabled={unenroll.isPending}
          onClick={() => unenroll.mutate(petId)}
        >
          등원 해지
        </Button>
      </div>
    );
  }

  if (enrollable.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        소속된 매장이 없습니다. 먼저 매장에 가입 신청하세요.
      </p>
    );
  }

  return (
    <Select
      onValueChange={(value: string) =>
        enroll.mutate({ petId, tenantId: value })
      }
      disabled={enroll.isPending}
    >
      <SelectTrigger className='w-48'>
        <SelectValue placeholder='등원할 매장 선택' />
      </SelectTrigger>
      <SelectContent>
        {enrollable.map((membership) => (
          <SelectItem key={membership.tenantId} value={membership.tenantId}>
            {membership.tenant.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
