"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pawlog/ui";
import { ROLES } from "@pawlog/shared";

import { useUpdateUserRole } from "../model/useUpdateUserRole";

/**
 * 역할 변경 셀렉트 (feature ui). 값 변경 시 곧바로 역할 변경 뮤테이션을 실행한다.
 */
export const RoleSelect = ({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) => {
  const updateRole = useUpdateUserRole();

  return (
    <Select
      value={role}
      onValueChange={(val: string) => updateRole.mutate({ id: userId, role: val })}
      disabled={updateRole.isPending}
    >
      <SelectTrigger className='w-32 border-slate-800 bg-slate-950 text-slate-200'>
        <SelectValue placeholder='역할 선택' />
      </SelectTrigger>
      <SelectContent className='border-slate-800 bg-slate-950 text-slate-200'>
        <SelectItem value={ROLES.USER}>일반 사용자</SelectItem>
        <SelectItem value={ROLES.ADMIN}>관리자</SelectItem>
      </SelectContent>
    </Select>
  );
};
