"use client";

import { Check, X } from "lucide-react";
import { Button } from "@pawlog/ui";
import { MEMBERSHIP_STATUS } from "@pawlog/shared";

import { useDecideMembership } from "../model/useDecideMembership";

/** 승인 대기 행에 붙는 승인/반려 버튼 (feature ui) */
export const DecideMembershipActions = ({
  membershipId,
}: {
  membershipId: string;
}) => {
  const decide = useDecideMembership();

  return (
    <div className='flex justify-end gap-2'>
      <Button
       
        disabled={decide.isPending}
        onClick={() =>
          decide.mutate({ id: membershipId, status: MEMBERSHIP_STATUS.ACTIVE })
        }
        className='gap-1.5'
      >
        <Check className='h-3.5 w-3.5' />
        승인
      </Button>
      <Button
       
        variant='outline'
        disabled={decide.isPending}
        onClick={() =>
          decide.mutate({
            id: membershipId,
            status: MEMBERSHIP_STATUS.REJECTED,
          })
        }
        className='gap-1.5'
      >
        <X className='h-3.5 w-3.5' />
        반려
      </Button>
    </div>
  );
};
