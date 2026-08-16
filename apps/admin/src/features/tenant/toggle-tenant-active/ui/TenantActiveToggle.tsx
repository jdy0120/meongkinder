"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Switch,
} from "@pawlog/ui";

import { useToggleTenantActive } from "../model/useToggleTenantActive";

interface TenantActiveToggleProps {
  tenant: { id: string; name: string; isActive: boolean };
}

/**
 * 테넌트 활성/정지 스위치 (feature ui).
 *
 * 정지는 해당 매장의 모든 요청을 즉시 403 으로 막는 파급이 큰 조치라 확인 다이얼로그를 거친다.
 * 재활성화는 되돌리는 방향이라 곧바로 반영한다.
 */
export const TenantActiveToggle = ({ tenant }: TenantActiveToggleProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toggleActive = useToggleTenantActive();

  const handleChange = (next: boolean) => {
    if (next) {
      toggleActive.mutate({ id: tenant.id, isActive: true });
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSuspend = () => {
    toggleActive.mutate({ id: tenant.id, isActive: false });
    setConfirmOpen(false);
  };

  return (
    <>
      <Switch
        checked={tenant.isActive}
        onCheckedChange={handleChange}
        disabled={toggleActive.isPending}
        aria-label={`${tenant.name} 활성 상태`}
        className='data-checked:bg-success-fill'
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className='gap-4 p-6'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-card text-foreground'>
              {tenant.name} 테넌트를 정지할까요?
            </AlertDialogTitle>
            <AlertDialogDescription className='text-text-muted'>
              정지하면 해당 매장의 관리자·스태프·보호자가 보내는 모든 요청이
              차단됩니다. 데이터는 삭제되지 않으며, 언제든 다시 활성화할 수
              있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              size='sm'
              className='cursor-pointer border-transparent bg-transparent px-5 text-text-muted neu-press'
            >
              취소
            </AlertDialogCancel>
            {/* ⚠️ `!` 필수 — `AlertDialogAction` 내부 `<Button variant="default">` 의
                `bg-primary` 와 특이도가 같고 Tailwind 출력에서 그쪽이 뒤에 와서 이긴다.
                없으면 정지(파괴적) 버튼이 파란색으로 나온다. */}
            <AlertDialogAction
              size='sm'
              onClick={confirmSuspend}
              className='cursor-pointer bg-danger! px-5 text-white! hover:bg-danger/85!'
            >
              정지
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
