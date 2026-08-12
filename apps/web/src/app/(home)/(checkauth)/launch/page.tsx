import { redirect } from "next/navigation";
import { MEMBERSHIP_STATUS, ROLES } from "@pawlog/shared";
import type { MembershipWithTenant } from "@pawlog/shared";

import { tenantPath } from "@/shared/libs/tenant/routes";
import { LaunchPage } from "@/views";

import { getMe } from "../layout";

/**
 * 로그인 착지점 (job-042) — 소속에 따라 갈 곳을 정한다.
 *
 * | 운영 중인 매장 | 결과 |
 * | --- | --- |
 * | 1개 | 그 매장으로 직행 (`/tenant/<subdomain>`) |
 * | 2개 이상 | 매장 고르기 화면 |
 * | 0개 | 개인 홈 (`/app`) |
 *
 * ## "운영 중인 매장"은 STAFF/TENANT_ADMIN 소속만이다
 *
 * GUARDIAN 소속을 포함하면, 아이를 한 곳에 맡긴 보호자가 로그인하자마자 매장 운영 화면에
 * 떨어진다. 그 화면은 출석부·원생 관리처럼 전부 스태프용이라 보호자에게는 메뉴가 하나도
 * 보이지 않고(`TenantHomePage` 가 "운영 권한이 없습니다" 카드를 띄운다), API 도 403 을
 * 돌려준다. 보호자의 집은 `/app` 이다.
 *
 * ## 왜 API 가 아니라 여기서 판단하나
 *
 * 매장 주소 규칙(`/tenant/<subdomain>/…`)은 web 의 것이다. 소셜 콜백이 그 주소를 직접
 * 조립하면 경로가 바뀔 때마다 API 와 web 을 같이 고쳐야 한다. 게다가 이 페이지는
 * `(checkauth)` 안에 있어서 **약관 게이트(job-041)를 그대로 물려받는다** — 최초 로그인
 * 사용자는 여기 오기 전에 `/welcome` 으로 걸러지고, 동의를 마치면 다시 여기로 돌아온다.
 *
 * 소속 목록은 `(checkauth)` 레이아웃이 이미 부르는 `mypage` 응답에 들어 있어 추가 요청이
 * 없다.
 */
export default async function Page() {
  const response = await getMe();
  if (!response.ok) {
    redirect("/auth/login");
  }

  const data = await response.json();
  const memberships: MembershipWithTenant[] = data.data.memberships ?? [];

  const operating = memberships.filter(
    (membership) =>
      membership.status === MEMBERSHIP_STATUS.ACTIVE &&
      membership.tenant.isActive &&
      (membership.role === ROLES.TENANT_ADMIN ||
        membership.role === ROLES.STAFF),
  );

  if (operating.length === 0) {
    redirect("/app");
  }
  if (operating.length === 1) {
    redirect(tenantPath(operating[0].tenant.subdomain));
  }

  return <LaunchPage memberships={operating} />;
}
