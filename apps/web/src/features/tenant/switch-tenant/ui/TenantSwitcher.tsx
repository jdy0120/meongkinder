"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2 } from "lucide-react";
import { MEMBERSHIP_STATUS } from "@pawlog/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pawlog/ui";
import { useRouter } from "next/navigation";

import {
  replaceTenantInPath,
  tenantPath,
} from "@/shared/libs/tenant/routes";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/**
 * 매장 전환기 (feature ui) — job-038.
 *
 * 활성 매장이 URL 로 결정되므로, 전환은 **상태 변경이 아니라 이동**이다.
 * 현재 경로의 매장 세그먼트만 바꿔 같은 화면의 다른 매장으로 넘어간다
 * (예: /tenant/acme/members → /tenant/beta/members).
 */
export const TenantSwitcher = () => {
  const router = useRouter();
  const params = useParams<{ tenant?: string }>();
  const memberships = useTenantStore((state) => state.memberships);

  const options = memberships.filter(
    (m) => m.status === MEMBERSHIP_STATUS.ACTIVE && m.tenant.isActive,
  );

  // 고를 매장이 하나뿐이면 전환기를 보여줄 이유가 없다.
  if (options.length <= 1) return null;

  const current = params?.tenant;

  return (
    <div className='flex items-center gap-2'>
      <Building2 className='h-4 w-4 text-muted-foreground' />
      <Select
        value={current}
        onValueChange={(subdomain: string) => {
          if (!current) {
            router.push(tenantPath(subdomain));
            return;
          }
          // 현재 화면을 유지한 채 매장만 바꾼다.
          router.push(
            replaceTenantInPath(window.location.pathname, subdomain),
          );
        }}
      >
        <SelectTrigger className='w-44'>
          <SelectValue placeholder='매장 선택' />
        </SelectTrigger>
        <SelectContent>
          {options.map((m) => (
            <SelectItem key={m.tenantId} value={m.tenant.subdomain}>
              {m.tenant.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link href='/tenants' className='text-xs text-muted-foreground underline'>
        내 매장
      </Link>
    </div>
  );
};
