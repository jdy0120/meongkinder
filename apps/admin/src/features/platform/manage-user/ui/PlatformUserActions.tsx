"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
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
import { ROLES } from "@pawlog/shared";

import {
  useDeletePlatformUser,
  useUpdatePlatformRole,
  useUpdateUserStatus,
} from "../model/useManagePlatformUser";

interface PlatformUserActionsProps {
  user: { id: string; nickname: string; role: string; status: string };
}

/**
 * 플랫폼 회원 행 액션 (feature ui) — 정지/해제 · SUPER_ADMIN 승격/강등 · 삭제.
 *
 * 삭제는 펫·소속까지 함께 사라지는 파괴적 조작이라 확인을 거치고, 정지로 충분한
 * 경우가 대부분이라는 점을 문구로 안내한다.
 */
export const PlatformUserActions = ({ user }: PlatformUserActionsProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateStatus = useUpdateUserStatus();
  const updateRole = useUpdatePlatformRole();
  const deleteUser = useDeletePlatformUser();

  const isSuspended = user.status === "SUSPENDED";
  const isSuperAdmin = user.role === ROLES.SUPER_ADMIN;
  const busy =
    updateStatus.isPending || updateRole.isPending || deleteUser.isPending;

  return (
    <div className='flex justify-end gap-2'>
      <Button
        size='sm'
        variant='outline'
        disabled={busy}
        onClick={() =>
          updateStatus.mutate({
            id: user.id,
            status: isSuspended ? "ACTIVE" : "SUSPENDED",
          })
        }
        className='h-8 rounded-lg border-slate-800 bg-transparent px-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-white'
      >
        {isSuspended ? "정지 해제" : "정지"}
      </Button>

      <Button
        size='sm'
        variant='outline'
        disabled={busy}
        onClick={() =>
          updateRole.mutate({
            id: user.id,
            role: isSuperAdmin ? ROLES.USER : ROLES.SUPER_ADMIN,
          })
        }
        className='h-8 gap-1 rounded-lg border-slate-800 bg-transparent px-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-white'
      >
        {isSuperAdmin ? (
          <>
            <ShieldOff className='h-3.5 w-3.5' />
            강등
          </>
        ) : (
          <>
            <ShieldCheck className='h-3.5 w-3.5' />
            승격
          </>
        )}
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Button
          size='sm'
          variant='outline'
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          className='h-8 gap-1 rounded-lg border-rose-500/30 bg-transparent px-3 text-xs text-rose-300 hover:bg-rose-500/10'
        >
          <Trash2 className='h-3.5 w-3.5' />
          삭제
        </Button>
        <AlertDialogContent className='rounded-2xl border-slate-800 bg-slate-900 text-slate-100'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-white'>
              {user.nickname} 님의 계정을 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription className='text-slate-400'>
              등록된 아이와 매장 소속이 함께 삭제되며 되돌릴 수 없습니다. 접근만
              막으려면 삭제 대신 <strong>정지</strong>를 사용하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='rounded-xl border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white'>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteUser.mutate(user.id);
                setConfirmDelete(false);
              }}
              className='rounded-xl bg-rose-600 font-semibold text-white hover:bg-rose-500'
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
