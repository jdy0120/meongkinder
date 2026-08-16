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
        className='cursor-pointer border-transparent bg-transparent px-3 text-text-muted neu-press'
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
        className='cursor-pointer gap-1.5 border-transparent bg-transparent px-3 text-text-muted neu-press'
      >
        {isSuperAdmin ? (
          <>
            <ShieldOff className='size-4' />
            강등
          </>
        ) : (
          <>
            <ShieldCheck className='size-4' />
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
          className='cursor-pointer gap-1.5 border-transparent bg-transparent px-3 text-danger-strong neu-press hover:bg-danger-tint'
        >
          <Trash2 className='size-4' />
          삭제
        </Button>
        <AlertDialogContent className='gap-4 p-6'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-card text-foreground'>
              {user.nickname} 님의 계정을 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription className='text-text-muted'>
              등록된 아이와 매장 소속이 함께 삭제되며 되돌릴 수 없습니다. 접근만
              막으려면 삭제 대신{" "}
              <strong className='font-semibold text-foreground'>정지</strong>를
              사용하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              size='sm'
              className='cursor-pointer border-transparent bg-transparent px-5 text-text-muted neu-press'
            >
              취소
            </AlertDialogCancel>
            {/* ⚠️ `!` 가 반드시 필요하다. `AlertDialogAction` 은 내부에서 `<Button
                variant="default">` 를 쓰고, 그 `bg-primary` 는 `bg-danger` 와 **특이도가
                같다** — 그러면 CSS 파일에서 나중에 선언된 쪽이 이기는데 Tailwind 출력에서는
                `bg-primary` 가 뒤에 온다. 그래서 `!` 없이는 **삭제 버튼이 파란색으로 나오고**,
                파괴적 동작이 일반 확인과 똑같아 보인다. */}
            <AlertDialogAction
              size='sm'
              onClick={() => {
                deleteUser.mutate(user.id);
                setConfirmDelete(false);
              }}
              className='cursor-pointer bg-danger! px-5 text-white! hover:bg-danger/85!'
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
