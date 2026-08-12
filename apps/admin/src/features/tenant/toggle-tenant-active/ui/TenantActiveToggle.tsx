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
        className='data-checked:bg-emerald-600'
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className='border-slate-800 bg-slate-900 text-slate-100 rounded-2xl'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-white'>
              {tenant.name} 테넌트를 정지할까요?
            </AlertDialogTitle>
            <AlertDialogDescription className='text-slate-400'>
              정지하면 해당 매장의 관리자·스태프·보호자가 보내는 모든 요청이
              차단됩니다. 데이터는 삭제되지 않으며, 언제든 다시 활성화할 수
              있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl'>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSuspend}
              className='bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold'
            >
              정지
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
