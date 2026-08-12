"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pawlog/ui";
import { ROLES, type MembershipRole } from "@pawlog/shared";

import { useUpdateMemberRole } from "../model/useManageMember";

/**
 * 구성원 역할 변경 셀렉트 (feature ui).
 * 플랫폼 역할(USER/SUPER_ADMIN)은 여기서 다루지 않는다 — 매장 안의 자격만 고른다.
 */
export const MemberRoleSelect = ({
  membershipId,
  role,
  disabled,
}: {
  membershipId: string;
  role: string;
  disabled?: boolean;
}) => {
  const updateRole = useUpdateMemberRole();

  return (
    <Select
      value={role}
      onValueChange={(val: string) =>
        updateRole.mutate({ id: membershipId, role: val as MembershipRole })
      }
      disabled={disabled || updateRole.isPending}
    >
      <SelectTrigger className='w-32'>
        <SelectValue placeholder='역할 선택' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ROLES.GUARDIAN}>보호자</SelectItem>
        <SelectItem value={ROLES.STAFF}>돌봄 스태프</SelectItem>
        <SelectItem value={ROLES.TENANT_ADMIN}>관리자</SelectItem>
      </SelectContent>
    </Select>
  );
};
