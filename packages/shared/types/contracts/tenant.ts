// 테넌트 도메인 API 계약 (request / response)
// - 온보딩: 매장 개설권 보유 회원이 신규 테넌트 개설 (인증 필요, 요청자가 TENANT_ADMIN 이 된다)
// - 관리: 플랫폼 운영자(SUPER_ADMIN)의 테넌트 목록/상세/수정/정지 (SUPER_ADMIN 전용)
import type { Tenant } from "@pawlog/database";
import type { SafeUser } from "../models/auth/user";
import type { DateKey } from "./pet";

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
  /**
   * 운영시간 (job-060). **선택**이다 — 주소와 같은 이유로 개설을 여기에 묶지 않는다.
   *
   * 다만 화면은 기본값(평일 09:00~19:00, 주말 휴무)을 **미리 채워서** 보여준다. 그
   * 값이 눈앞에 보이는 채로 개설을 누르는 것은 확인한 것이므로, 아무도 입력한 적 없는
   * 칸을 서버가 조용히 채우는 것과 다르다. 이렇게 하면 개설 첫날부터 보호자의 등원
   * 예약 달력이 돌아간다 — 운영시간이 없으면 그 달력은 통째로 잠긴다.
   */
  businessHours?: BusinessHours | null;
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

// ── 매장 운영시간 (job-060) ───────────────────────────
//
// 판정·정규화·표기 헬퍼는 `packages/shared/src/business-hours.ts` 에 있다(런타임 값이라
// 이 파일에 두면 컴파일 시 지워진다).
//
// **왜 관계 테이블이 아니라 JSONB 인가**: 운영시간은 언제나 7일을 통째로 읽고 쓰는 값
// 객체다 — "수요일만 부분 갱신" 같은 요청이 없다. 관계 테이블로 쪼개면 저장할 때마다
// 7행 delete+insert 를 하고, 그 모델을 Prisma Extension 의 테넌트 스코프 대상과 RLS
// 정책에 추가로 등록해야 하는데, 그 대가로 얻는 게 없다. Tenant 의 칸으로 두면 테넌트
// 격리를 그대로 물려받는다.
//
// ⚠️ 대신 **DB 가 모양을 검사해 주지 않는다.** 그래서 쓸 때는 `validateBusinessHours` +
// `normalizeBusinessHours` 를, 읽을 때는 `parseBusinessHours` 를 반드시 거친다.

/**
 * `"HH:mm"` 24시간 표기.
 *
 * 마감 시각(그리고 휴게 종료)에 한해 `"24:00"` 을 허용한다 — 자정 마감을 `"00:00"` 으로
 * 쓰면 시작과 같아져 "0분 영업"과 구분되지 않고, `"23:59"` 로 쓰면 1분이 조용히 사라진다.
 * `"00:00"~"24:00"` 이 곧 24시간 영업이다.
 */
export type TimeOfDay = string;

/** 휴게시간(브레이크타임). 점심 산책·낮잠 등으로 등하원을 받지 않는 구간. */
export interface BusinessBreak {
  start: TimeOfDay;
  end: TimeOfDay;
}

export interface BusinessDay {
  /** 0=일 … 6=토. `Date.getDay()` · `WEEKDAY_LABELS` 와 같은 순서다. */
  day: number;
  /** 휴무면 `open`/`close`/`breaks` 는 읽지 않는다(값은 남아 있어도 무의미). */
  closed: boolean;
  open: TimeOfDay;
  /**
   * 마감. `close < open` 이면 **자정을 넘긴 영업**이다(예: 20:00~02:00, 애견호텔).
   * 판정 함수들이 이 규칙을 알고 있으므로 저장 쪽에서 보정하지 않는다.
   */
  close: TimeOfDay;
  breaks: BusinessBreak[];
}

export interface BusinessHours {
  /** 항상 7개, `day` 0~6 이 각각 정확히 한 번. 서버가 저장 전에 이 모양으로 맞춘다. */
  days: BusinessDay[];
  /** 법정 공휴일 휴무 여부. 공휴일 달력 자체는 아직 갖고 있지 않아 **표기 전용**이다. */
  closedOnPublicHolidays: boolean;
  /** 시간표로 표현되지 않는 안내(예: "마지막 등원 17:00까지"). */
  note: string | null;
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
  // job-063: 매장 소개 · 대표 이미지
  | "description"
  | "profileImageFileId"
> & {
  /**
   * 운영시간. **`null` 은 "아직 등록하지 않았다"** 이며 "매일 휴무"가 아니다.
   *
   * 이 구분을 흐리면 안 된다(job-052 접종 기록과 같은 이유) — 아무도 입력한 적 없는
   * 매장을 "휴무"로 그리면 보호자는 그 매장이 문을 닫았다고 읽고, 반대로 기본값을
   * 채워 그리면 매장이 말한 적 없는 시간을 우리가 지어내 보여주게 된다.
   *
   * `Tenant.businessHours` 는 JSONB 라 Prisma 가 `JsonValue` 로 주므로 Pick 으로는
   * 실제 모양이 나오지 않는다. 계약에서 좁히고, 서버는 `parseBusinessHours` 를 거친
   * 값만 내려보내 이 타입이 진실이 되게 한다.
   */
  businessHours: BusinessHours | null;
};

// ── 임시 휴무일 (job-060) ─────────────────────────────
//
// 요일 시간표(`BusinessHours`)가 "평소"라면 이쪽은 그 예외 — 명절·워크샵·소독·원장
// 사정처럼 요일 패턴으로 표현할 수 없는 하루다.
//
// ⚠️ 별도 엔드포인트인 이유: `businessHours` 는 7일을 통째로 덮어쓰지만 휴무일은 **개별로
// 추가·삭제**된다. 같은 페이로드에 실으면 휴무일 하나를 지우려고 운영시간 전체를 다시
// 보내야 하고, 그 사이 다른 탭에서 시간표를 고치면 한쪽이 통째로 사라진다.

export interface TenantClosureEntry {
  id: string;
  /** `"YYYY-MM-DD"` */
  date: DateKey;
  /** 보호자에게 그대로 보인다. 없으면 화면이 "휴무"로만 표시한다. */
  reason: string | null;
}

export interface TenantClosureListResponse {
  closures: TenantClosureEntry[];
}

export interface CreateTenantClosureRequest {
  date: DateKey;
  reason?: string;
}

export interface CreateTenantClosureResponse {
  closure: TenantClosureEntry;
  /**
   * 이 휴무 때문에 **풀린 등원 예정일 수** (삭제된 `PetSchedule` 행).
   *
   * 쉬는 날로 지정하면 그 날 잡혀 있던 예약은 성립할 수 없으므로 함께 지운다. 남겨 두면
   * 보호자 화면에는 예약이 살아 있어서, 그 사람은 문 닫은 매장 앞에 아이를 데리고 선다.
   */
  releasedReservations: number;
  /**
   * 이 휴무의 영향을 받은 **아이 수** = 통보 대상 (job-060).
   *
   * ⚠️ `releasedReservations` 와 다를 수 있고, 그게 정상이다. 대상은 삭제된 행이 아니라
   * **그 날 오기로 돼 있던 아이 전부**다 — WEEKLY 정기 등원일은 요일 패턴이라 날짜 행으로
   * 저장되지 않으므로(job-053), 행만 세면 매주 그 요일에 오는 아이들이 통째로 빠진다.
   * 이미 등원 체크가 끝난 아이는 빠진다(그 사람에게 "취소되었습니다"는 사실이 아니다).
   */
  affectedPets: number;
  /**
   * 그중 안내가 **실제로 나간 수** — 알림톡/SMS 발송에 성공한 건만 센다.
   *
   * `affectedPets` 보다 작으면 그 차이가 곧 **원장이 직접 전화해야 하는 수**다.
   * 연락처가 아예 없거나(미가입 보호자로 등록되지 않은 아이) 발송이 실패한 경우다.
   * 화면은 두 수를 함께 보여준다 — 합치면 그 차이가 사라져 아무도 챙기지 않게 된다.
   */
  notifiedGuardians: number;
}

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
  /**
   * 매장 소개 (job-063). **공개 정보**라 매장 찾기 목록에 그대로 나간다.
   * 빈 문자열이면 지운다(보내지 않는 것과 다른 뜻이다).
   */
  description?: string;
  /**
   * 매장 대표 이미지 파일 id (job-063). 빈 문자열이면 지운다.
   *
   * 서버가 저장 시 `FileOwnership.shared` 로 승격한다 — 로그인 없이 열리는 공개 화면에
   * 나가야 하므로 매장 소유로 두면 그 화면에서 403 이 된다(job-055).
   */
  profileImageFileId?: string;
  /**
   * 운영시간. `null` 을 **명시적으로** 보내면 등록을 지운다(미설정으로 되돌린다).
   * 보내지 않으면(`undefined`) 기존 값을 건드리지 않는다 — 이 둘은 다른 뜻이다.
   */
  businessHours?: BusinessHours | null;
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
