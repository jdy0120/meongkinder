"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@pawlog/ui";

import { useRemoveMember } from "../model/useManageMember";

/** 구성원 내보내기 버튼 (feature ui). 되돌리기 어려운 조작이라 확인을 거친다. */
export const RemoveMemberButton = ({
  membershipId,
  nickname,
}: {
  membershipId: string;
  nickname: string;
}) => {
  const [open, setOpen] = useState(false);
  const removeMember = useRemoveMember();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
       
        variant='outline'
        onClick={() => setOpen(true)}
        className='gap-1.5'
      >
        <UserMinus className='h-3.5 w-3.5' />
        내보내기
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{nickname} 님을 내보낼까요?</AlertDialogTitle>
          <AlertDialogDescription>
            이 매장에서의 소속이 해제되어 더 이상 접근할 수 없게 됩니다. 등록된
            아이의 출석·리포트 기록은 그대로 남습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              removeMember.mutate(membershipId);
              setOpen(false);
            }}
          >
            내보내기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
