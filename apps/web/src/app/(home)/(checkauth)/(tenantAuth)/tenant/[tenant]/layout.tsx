import React from "react";
import { notFound, redirect } from "next/navigation";
import { ROLES, type MembershipRole } from "@pawlog/shared";

import { PlatformViewBanner } from "@/shared/ui";
import { TenantRouteSync } from "@/shared/libs/tenant/TenantRouteSync";
import { getTenantBySubdomain } from "@/shared/libs/tenant/getTenantBySubdomain";
import { getMe } from "../../../layout";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

interface MembershipSummary {
  status: string;
  role: MembershipRole;
  tenantId: string;
  tenant: { id: string; name: string; subdomain: string; isActive: boolean };
}

/**
 * 매장 전용 영역 게이트 (job-038).
 *
 * `(checkauth)` 가 "로그인했는가"를 본다면, 여기는 **"URL 이 가리키는 그 매장을 실제로
 * 이용할 수 있는가"** 를 본다. 경로는 `/tenant/[tenant]/…` 이고 `[tenant]` 는 매장의 subdomain 이다.
 *
 * `tenant/` 고정 접두사를 두는 이유: 접두사가 없으면 매장 주소가 web 의 최상위 경로와
 * 같은 네임스페이스를 쓴다. subdomain 이 `pet` 인 매장은 정적 세그먼트인 `/pet`(내 아이)에
 * 가려 영원히 열리지 않는다. 접두사가 있으면 두 네임스페이스가 분리돼 web 에 최상위
 * 경로를 추가해도 기존 매장이 사라지지 않는다.
 *
 * 활성 매장을 localStorage 가 아니라 **URL 이 결정한다**는 게 핵심이다:
 *   - 어느 매장을 보고 있는지가 주소에 드러나 공유·북마크가 된다
 *   - 겸업(A매장 스태프 + B매장 보호자)이 두 탭에서 동시에 열려도 섞이지 않는다
 *   - 나중에 서브도메인 라우팅(acme.pawlog.com/pet)으로 옮겨도 구조가 그대로다
 *
 * 통과 조건은 **누구로 들어오느냐**에 따라 둘로 갈린다.
 *
 * ① 소속 구성원 — 셋을 모두 만족해야 한다:
 *   1. 그 subdomain 의 매장에 소속돼 있을 것 (없으면 404: 매장 존재 자체를 노출하지 않는다)
 *   2. 멤버십 status === "ACTIVE"   (승인 대기는 통과 못 함)
 *   3. tenant.isActive === true     (구독 만료·미납으로 정지된 매장 제외)
 *
 * ② 플랫폼 관리자(SUPER_ADMIN) — 소속 없이 통과한다 (job-050).
 *
 * 왜 예외인가: **API 는 이미 그렇게 동작하고 있었다.** TenantMiddleware 는 SUPER_ADMIN 의
 * 멤버십 검사를 건너뛰고(`tenant.middleware.ts`), 매장 스코프 컨트롤러들은 하나도 빠짐없이
 * `@Roles(..., ROLES.SUPER_ADMIN)` 으로 열려 있다. 그런데 이 레이아웃만 멤버십으로 404 를
 * 내고 있었다 — 즉 접근은 이미 가능한데 화면만 없는 상태였고, 그래서 정상적인 운영 지원은
 * 불가능하면서 흔적도 남지 않았다. 2계층 역할 모델(플랫폼/테넌트)에 1계층 검사만
 * 적용한 것이 원인이다.
 *
 * ⚠️ 다만 **소속으로 위장하지 않는다**: `currentRole` 은 null 로 두고 `isPlatformAdmin`
 * 으로 따로 표시해, 화면 상단에 열람 배너가 뜨고 메뉴는 권한 기준으로 열린다.
 * SUPER_ADMIN 에게는 매장 정지 여부도 게이트하지 않는다 — 정지 매장을 열어보고 다시
 * 활성화하는 주체가 본인이라, 막으면 복구 경로가 사라진다(미들웨어의 assertActive 와 같은 이유).
 *
 * 매장별 세부 권한(STAFF 가 구성원 관리에 접근 등)은 여기서 판정하지 않는다.
 * 그건 매 요청마다 서버의 TenantMiddleware + RolesGuard 가 검증한다 —
 * 이 레이아웃은 UX 가드이고, 실제 방어는 API 다.
 */
const layout = async ({ children, params }: LayoutProps) => {
  const { tenant: subdomain } = await params;
  const response = await getMe();

  if (!response.ok) {
    redirect("/auth/login");
  }

  const data = await response.json();
  const memberships: MembershipSummary[] = data.data.memberships ?? [];
  const isPlatformAdmin = data.data.user?.role === ROLES.SUPER_ADMIN;

  const membership = memberships.find(
    (m) => m.tenant?.subdomain === subdomain,
  );

  if (!membership) {
    // 소속되지 않은 매장은 존재 여부조차 알려주지 않는다 — 단, 플랫폼 관리자는 예외다.
    if (!isPlatformAdmin) {
      notFound();
    }

    // 소속이 없으니 tenantId 를 알 방법이 URL 의 subdomain 뿐이다. 조회로 매장을 특정한다.
    // 이 엔드포인트도 `@Roles(SUPER_ADMIN)` 이라, 권한이 없으면 여기서 null 이 되어
    // 아래 404 로 수렴한다 — 권한 판정을 웹이 대신하지 않는다.
    const tenant = await getTenantBySubdomain(subdomain);
    if (!tenant) {
      notFound();
    }

    return (
      <>
        <TenantRouteSync
          tenantId={tenant.id}
          role={null}
          isPlatformAdmin
          tenantName={tenant.name}
        />
        <PlatformViewBanner tenantName={tenant.name} />
        {children}
      </>
    );
  }

  // 소속이 있더라도 SUPER_ADMIN 이면 상태 게이트를 적용하지 않는다.
  // (예: 정지된 매장을 다시 살리려면 먼저 들어가서 볼 수 있어야 한다)
  if (!isPlatformAdmin) {
    if (membership.status !== "ACTIVE") {
      // 승인 대기/반려 — 신청 현황을 볼 수 있는 화면으로 보낸다.
      redirect("/tenants");
    }

    if (!membership.tenant.isActive) {
      redirect("/tenants?error=inactive");
    }
  }

  return (
    <>
      {/* 이후 모든 API 요청이 이 매장으로 스코프되도록 store 에 심는다. */}
      <TenantRouteSync
        tenantId={membership.tenantId}
        role={membership.role}
        isPlatformAdmin={isPlatformAdmin}
        tenantName={membership.tenant.name}
      />
      {/* 소속이 있어도 플랫폼 권한으로 열린 메뉴를 쓰는 중이면 그 사실을 표시한다.
          예: GUARDIAN 으로만 소속된 매장인데 SUPER_ADMIN 이라 운영 메뉴가 전부 보이는 경우. */}
      {isPlatformAdmin && (
        <PlatformViewBanner tenantName={membership.tenant.name} />
      )}
      {children}
    </>
  );
};

export default layout;
