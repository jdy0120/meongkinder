"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Store, TriangleAlert } from "lucide-react";
import { Card, CardContent, Spinner } from "@pawlog/ui";
import {
  MEMBERSHIP_STATUS,
  ROLES,
  type MembershipWithTenant,
} from "@pawlog/shared";

import { tenantPath } from "@/shared/libs/tenant/routes";
import { SectionHeading } from "@/shared/ui";
import { roleLabel } from "@/entities/user";
import { MembershipStatusBadge, useMyMemberships } from "@/entities/membership";

/** 매장을 **운영하는** 자격. 보호자 소속과는 화면에서 다루는 방식이 다르다. */
const OPERATOR_ROLES: string[] = [ROLES.TENANT_ADMIN, ROLES.STAFF];

/**
 * 내 매장 목록 위젯.
 *
 * ## 운영 매장과 보호자 소속을 나눈다
 *
 * "내 매장"은 **내가 일하는 곳**이다 — 관리자(원장)이거나 스태프인 매장. 아이를 맡긴
 * 매장은 성격이 다르다: 거기서 내가 하는 일은 없고 볼 것은 우리 아이 소식뿐이라,
 * 한 목록에 섞으면 원장 겸 보호자인 사람의 화면에서 **들어가서 일할 곳과 그냥 소속된 곳이
 * 구분되지 않는다.** 그래서 운영 매장을 위에 두고, 보호자 소속은 아래 별도 섹션으로 내린다.
 *
 * ⚠️ 보호자 소속을 **화면에서 없애지는 않았다.** 두 경로가 이 목록에 매달려 있다:
 *   1. `(tenantAuth)` 게이트가 승인 대기(PENDING)인 사람을 `/tenants` 로 돌려보낸다 —
 *      "신청 현황을 볼 수 있는 화면"이라는 전제다. 보호자 신청이 여기서 사라지면
 *      그 리다이렉트는 빈 화면으로 떨어진다.
 *   2. 이 페이지의 "매장 찾기"(`ApplyMembershipDialog`)로 낸 신청의 유일한 피드백이다.
 *
 * 승인 대기 건을 계속 보여주는 이유는 그대로다 — 신청해 놓고 목록에서 사라지면
 * "신청이 안 들어갔나"가 되고, 정지된 매장이 사라지면 "내 매장이 없어졌다"가 된다.
 *
 * 제목/설명과 "매장 찾기" 버튼은 페이지(view)의 PageShell 이 갖는다 — 예전엔 이 위젯이
 * 같은 "내 매장" 제목을 한 번 더 그려 화면에 제목이 두 개 보였다.
 */
export const MyTenants = () => {
  const { data: memberships, isLoading } = useMyMemberships();
  // `(tenantAuth)` 게이트가 정지된 매장에서 여기로 되돌려 보낼 때 붙여주는 값.
  // 이유를 화면에 적어주지 않으면 사용자는 "눌렀는데 튕겼다"로만 느낀다.
  const isInactiveRedirect = useSearchParams()?.get("error") === "inactive";

  if (isLoading) {
    return (
      <div className='flex justify-center py-12'>
        <Spinner className='size-6' />
      </div>
    );
  }

  const all = memberships ?? [];
  const operating = all.filter((m) => OPERATOR_ROLES.includes(m.role));
  const asGuardian = all.filter((m) => !OPERATOR_ROLES.includes(m.role));

  // 소속이 하나도 없으면 섹션을 나누지 않는다 — 빈 카드 두 장은 "무엇을 해야 하는가"를
  // 오히려 흐린다. 이 화면을 처음 여는 사람은 대개 보호자라, 번호 등록 안내를 함께 준다
  // (매장이 미리 등록해 둔 아이와 이어지는 유일한 키다 — job-040).
  if (all.length === 0) {
    return (
      <Card className='border-dashed'>
        <CardContent className='flex flex-col items-center gap-2 py-12 text-center'>
          <Store className='size-6 text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>
            아직 소속된 매장이 없습니다. 위의 &lsquo;매장 찾기&rsquo;로
            신청하거나, 매장에서 내 번호로 초대해 두었다면{" "}
            <Link href='/profile' className='font-medium underline'>
              내 정보
            </Link>
            에 휴대폰 번호를 등록해보세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {isInactiveRedirect && (
        <div className='flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive'>
          <TriangleAlert className='mt-0.5 size-4 shrink-0' />
          <p>
            해당 매장은 현재 운영이 중지되어 들어갈 수 없습니다. 매장에 문의해
            주세요.
          </p>
        </div>
      )}

      <section className='space-y-3'>
        <SectionHeading>운영 중인 매장</SectionHeading>
        {operating.length === 0 ? (
          <Card className='border-dashed'>
            <CardContent className='flex flex-col items-center gap-2 py-12 text-center'>
              <Store className='size-6 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>
                관리자나 스태프로 일하는 매장이 없습니다. 아래 &lsquo;내 매장
                열기&rsquo;로 직접 열거나, 매장에서 초대를 받으면 여기에
                나타납니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className='space-y-2'>
            {operating.map((membership) => (
              <TenantRow key={membership.id} membership={membership} showRole />
            ))}
          </div>
        )}
      </section>

      {/* 아이를 맡긴 매장. 운영 매장이 하나도 없으면 이쪽이 사실상 주 목록이 되므로
          없을 때는 섹션째 감춘다 — 빈 카드 두 장이 이어지면 화면이 더 헷갈린다. */}
      {asGuardian.length > 0 && (
        <section className='space-y-3'>
          <SectionHeading>아이를 맡긴 매장</SectionHeading>
          <div className='space-y-2'>
            {asGuardian.map((membership) => (
              <TenantRow key={membership.id} membership={membership} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

/** 매장 한 줄. 들어갈 수 있을 때만 링크가 된다. */
const TenantRow = ({
  membership,
  showRole = false,
}: {
  membership: MembershipWithTenant;
  /** 운영 매장은 원장인지 스태프인지가 할 수 있는 일을 가르므로 함께 적는다. */
  showRole?: boolean;
}) => {
  const usable =
    membership.status === MEMBERSHIP_STATUS.ACTIVE &&
    membership.tenant.isActive;

  const row = (
    <div className='flex items-center gap-3 rounded-xl border p-3'>
      <div className='min-w-0 flex-1'>
        <p className='truncate font-medium'>{membership.tenant.name}</p>
        <p className='truncate text-xs text-muted-foreground'>
          {membership.status === MEMBERSHIP_STATUS.PENDING
            ? "관리자 승인을 기다리는 중입니다."
            : !membership.tenant.isActive
              ? "운영이 중지된 매장입니다."
              : showRole
                ? `${roleLabel(membership.role)} · ${membership.tenant.subdomain}`
                : membership.tenant.subdomain}
        </p>
      </div>
      <MembershipStatusBadge status={membership.status} />
      {/* 들어갈 수 있는 매장만 눌리는 티를 낸다. */}
      {usable && (
        <ChevronRight className='size-4 shrink-0 text-muted-foreground' />
      )}
    </div>
  );

  // 이용 가능한 매장만 매장 화면(/tenant/<subdomain>)으로 들어갈 수 있다.
  return usable ? (
    <Link
      href={tenantPath(membership.tenant.subdomain)}
      className='block rounded-xl transition-colors hover:bg-accent'
    >
      {row}
    </Link>
  ) : (
    row
  );
};
