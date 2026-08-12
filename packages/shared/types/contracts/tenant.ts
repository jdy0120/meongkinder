// 테넌트 도메인 API 계약 (request / response)
// - 온보딩: 매장 개설권 보유 회원이 신규 테넌트 개설 (인증 필요, 요청자가 TENANT_ADMIN 이 된다)
// - 관리: 플랫폼 운영자(SUPER_ADMIN)의 테넌트 목록/상세/수정/정지 (SUPER_ADMIN 전용)
import type { Tenant } from "@pawlog/database";
import type { SafeUser } from "../models/auth/user";

// ── 요청 ──────────────────────────────────────────────
// job-034: 로그인한 회원이 보유한 매장 개설권으로 개설하므로 관리자 계정 정보를 받지 않는다.
// 요청자가 곧바로 해당 테넌트의 TENANT_ADMIN 이 된다.
/**
 * 매장 주소 (job-059).
 *
 * 전부 **선택**이다. 매장 개설을 주소 입력에 묶으면 개설 자체가 막히는데, 주소는 나중에
 * 매장 설정에서 넣어도 아무 문제가 없다 — 없는 동안 지도에만 안 뜬다.
 *
 * 좌표는 여기 없다. **주소를 저장하는 순간 서버가 지오코딩해서 채운다** — 클라이언트가
 * 보내게 하면 주소와 좌표가 서로 다른 곳을 가리키는 걸 막을 방법이 없다.
 */
export interface TenantAddressInput {
  postalCode?: string;
  roadAddress?: string;
  /** 층/호. 공개 디렉터리에는 실리지 않는다. */
  addressDetail?: string;
}

// job-034: 로그인한 회원이 보유한 매장 개설권으로 개설하므로 관리자 계정 정보를 받지 않는다.
// 요청자가 곧바로 해당 테넌트의 TENANT_ADMIN 이 된다.
export interface OnboardTenantRequest extends TenantAddressInput {
  tenantName: string; // 테넌트(매장) 이름
  subdomain: string; // 서브도메인 (소문자 영숫자 + 하이픈)
}

// ── 응답 (data 페이로드) ──────────────────────────────
// 성공 message 는 BaseResponse.message(봉투)에 담긴다.
export interface OnboardTenantResponse {
  tenant: Tenant;
  user: SafeUser;
}

export interface SubdomainAvailabilityResponse {
  subdomain: string;
  available: boolean;
  reason?: string; // available=false 일 때 사용자에게 보여줄 사유
}

// ── 테넌트 관리 (SUPER_ADMIN 전용) ────────────────────
// 소속 구성원/반려동물 수를 함께 내려 목록에서 규모를 가늠할 수 있게 한다.
// job-033: 소속은 TenantMembership 으로 표현되므로 users -> memberships.
export interface TenantSummary extends Tenant {
  _count: {
    memberships: number;
    pets: number;
  };
}

// 서브도메인 조회 응답 (job-050) — apps/web 매장 게이트가 SUPER_ADMIN 으로 매장을 열 때 쓴다.
// 게이트가 판단에 필요한 것만 담는다: 어느 매장인지(id·name)와 정지 여부(isActive).
export type TenantLookup = Pick<
  Tenant,
  "id" | "name" | "subdomain" | "isActive"
>;

// 테넌트 정보 수정 — 필드는 선택적(부분 수정).
// subdomain 변경은 기존 접속 URL 을 무효화하므로 신중히 다뤄야 한다(형식·중복 검증은 온보딩과 동일 경로).
export interface UpdateTenantRequest {
  name?: string;
  subdomain?: string;
}

export interface UpdateTenantResponse {
  tenant: Tenant;
}

// 테넌트 활성/정지 토글. isActive=false 면 TenantMiddleware 가 해당 테넌트의 모든 요청을 403 으로 차단한다.
export interface UpdateTenantActiveRequest {
  isActive: boolean;
}

export interface UpdateTenantActiveResponse {
  tenant: Tenant;
}

// ── 매장 설정 (job-059) — TENANT_ADMIN 이 **자기 매장**을 고친다 ────────
//
// `PATCH v1/tenants/:id` 와 헷갈리면 안 된다. 그쪽은 SUPER_ADMIN 전용 플랫폼 운영 경로라
// 원장은 부를 수 없었고, 그래서 원장이 자기 매장 주소를 넣을 방법이 **아예 없었다.**
// 이 경로는 활성 테넌트(`X-Tenant-Id`)를 대상으로 하므로 id 를 받지 않는다 — 남의 매장
// id 를 넣어볼 자리 자체를 없앤다.

/** 매장 설정 화면이 보는 값. 원장에게는 상세주소까지 전부 보인다. */
export type TenantSettings = Pick<
  Tenant,
  | "id"
  | "name"
  | "subdomain"
  | "contactPhone"
  | "postalCode"
  | "roadAddress"
  | "addressDetail"
  | "latitude"
  | "longitude"
  | "isListed"
  | "isActive"
>;

/**
 * 부분 수정. 보내지 않은 칸은 건드리지 않는다.
 *
 * `subdomain` 은 여기에 **없다** — 바꾸면 그 매장의 모든 링크(공유된 주소 포함)가 죽는데,
 * 그건 원장이 설정 화면에서 무심코 할 일이 아니다. 플랫폼 경로에 그대로 남겨 둔다.
 */
export interface UpdateTenantSettingsRequest extends TenantAddressInput {
  name?: string;
  contactPhone?: string;
  isListed?: boolean;
}

export interface UpdateTenantSettingsResponse {
  tenant: TenantSettings;
  /**
   * 이번 저장에서 주소를 좌표로 바꾸지 못했는가.
   *
   * 저장은 성공했으므로 에러가 아니지만, 화면은 **"지도에 표시되지 않는다"**를 말해줘야
   * 한다. 아니면 원장은 주소를 넣었는데 왜 지도에 안 나오는지 영영 알 수 없다.
   */
  geocodeFailed?: boolean;
}
