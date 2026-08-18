// 테넌트 멤버십 도메인 API 계약 (job-033)
//
// 회원이 테넌트에 소속되는 경로는 두 가지다.
//  1) 보호자 가입 신청 → 테넌트 관리자 승인  (GUARDIAN)
//  2) 테넌트 관리자가 직접 초대/등록          (STAFF / TENANT_ADMIN)
import type {
  Tenant,
  TenantInvitation,
  TenantMembership,
} from "@pawlog/database";
import type { MembershipRole, MembershipStatus } from "../../src/roles";
import type { SafeUser } from "../models/auth/user";
import type { BusinessHours } from "./tenant";

// ── 요청 ──────────────────────────────────────────────

/** 보호자로서 특정 테넌트에 가입 신청. 생성 결과는 status: "PENDING". */
export interface ApplyMembershipRequest {
  tenantId: string;
}

/** 신청 승인/반려 (테넌트 관리자). */
export interface DecideMembershipRequest {
  status: Extract<MembershipStatus, "ACTIVE" | "REJECTED">;
}

/** 이미 소속된 구성원의 역할 변경 (테넌트 관리자). */
export interface UpdateMembershipRoleRequest {
  role: MembershipRole;
}

/** 관리자가 기존 회원을 이메일로 스태프/관리자로 등록. 승인 절차 없이 곧바로 ACTIVE. */
export interface InviteMemberRequest {
  email: string;
  role: Extract<MembershipRole, "STAFF" | "TENANT_ADMIN">;
}

// ── 응답 (data 페이로드) ──────────────────────────────

/**
 * 구성원 목록용 — 누구인지 보여줘야 하므로 회원 정보를 함께 내린다.
 * 미가입 초대와 대조할 수 있도록 연락처(phone)도 포함한다.
 */
export interface MembershipWithUser extends TenantMembership {
  user: Pick<SafeUser, "id" | "email" | "nickname"> & { phone: string | null };
}

/** "내 소속" 목록용 — 어느 매장인지 보여줘야 하므로 테넌트 정보를 함께 내린다. */
export interface MembershipWithTenant extends TenantMembership {
  tenant: Pick<Tenant, "id" | "name" | "subdomain" | "isActive">;
}

export interface MembershipResponse {
  membership: TenantMembership;
}

/**
 * 로그인 사용자가 접근 가능한 테넌트 목록 (mypage 응답에 포함).
 * JWT 가 더 이상 tenantId 를 담지 않으므로, 클라이언트는 이 목록에서 활성 테넌트를 골라
 * `X-Tenant-Id` 헤더로 보낸다.
 */
export interface MyMembershipsResponse {
  memberships: MembershipWithTenant[];
}

/** 보호자가 가입 신청할 매장을 찾기 위한 공개 검색 결과 (민감 정보 없음). */
/**
 * 공개 매장 찾기 항목.
 *
 * ⚠️ 이 응답은 `@Public()` 이다 — **로그인 없이 누구나 받는다.** 그래서 여기 담는 것은
 * 전부 "영업 정보로서 공개해도 되는가"를 통과해야 한다.
 *
 *   담는다   : 이름 · 도로명 주소 · 좌표 · 대표 연락처 (지도에 찍고 전화를 걸 수 있어야 한다)
 *   안 담는다: **상세주소(층/호)** · 구성원/원생 수 · 매출 등 운영 정보
 *
 * 상세주소를 뺀 이유는 핀에 필요 없기 때문만이 아니다. 소규모 매장은 주소가 곧 자택인
 * 경우가 있어, 공개 범위는 "찾아갈 수 있을 만큼"에서 끊는다.
 */
export interface TenantDirectoryEntry {
  id: string;
  name: string;
  subdomain: string;
  roadAddress: string | null;
  /** 좌표가 없는 매장은 목록에는 나오지만 지도에는 찍히지 않는다. */
  latitude: number | null;
  longitude: number | null;
  contactPhone: string | null;
  /**
   * 운영시간 (job-060). 영업 정보라 공개해도 되는 축에 든다 — 오히려 보호자가 매장을
   * 고를 때 주소 다음으로 먼저 보는 값이다.
   *
   * `null` 은 "등록하지 않았다"이며 "휴무"가 아니다. 화면은 이 둘을 구분해서 그려야 한다.
   */
  businessHours: BusinessHours | null;
}

/**
 * 매장 찾기 질의 (job-059).
 *
 * 이름 검색과 지도 영역 검색을 **한 엔드포인트가 받는다.** 예전에는 `search` 만 있었고,
 * 그마저 프런트가 "검색어가 있을 때만" 호출해서 **이미 아는 매장만 찾을 수 있었다.**
 */
export interface TenantDirectoryQuery {
  /** 이름/서브도메인 부분 일치. */
  search?: string;
  /** 지도 뷰포트(bounding box). 넷이 모두 있을 때만 영역 필터로 쓴다. */
  swLat?: number;
  swLng?: number;
  neLat?: number;
  neLng?: number;
}

// ── 초대 (job-034) ────────────────────────────────────
// 초대 대상이 이미 회원이면 곧바로 멤버십이 만들어진다.
// 아직 회원이 아니면 연락처와 아이 정보를 담은 TenantInvitation 이 남고,
// 그 사람이 같은 이메일/전화번호로 가입하는 순간 자동으로 매칭된다.

/**
 * 구성원 초대 — **자격 부여 전용**이다 (job-058).
 *
 * 아이 정보(`petName`/`petSpecies`/`petBreed`/`petBirthDate`/`guardianName`/`note`)를
 * 받던 칸을 없앴다. 그 경로는 job-040 의 원생 등록 단일 진입점
 * (`POST v1/admin/pets/intake`) 과 **같은 일을 하면서 결과가 나쁜 중복**이었기 때문이다:
 *
 *   - intake  : Pet 을 **즉시** 만든다(`userId = null`) → 그날부터 등하원·사진·알림톡이 돈다
 *   - 초대     : Pet 을 **수락 시점에** 만든다 → 보호자가 가입할 때까지 아무것도 못 한다
 *
 * 이 제품의 전제가 "보호자에게 앱 설치를 선행 조건으로 요구하지 않는다" 이므로, 가입을
 * 기다려야 하는 쪽은 쓰면 안 된다. 실사용 데이터도 같은 말을 했다 — 초대 31건 중 28건이
 * intake 가 만든 `petId` 자리표시자였고 폼으로 아이 이름을 넣은 건 3건뿐이었다.
 *
 * ⚠️ **수집만 멈춘 것이고 소비는 살아 있다.** DB 컬럼과 `attachWithPet` 의 `petName`
 * 분기는 그대로다 — 아직 수락되지 않은 기존 초대장이 그 값을 물고 있어서, 지우면 그
 * 보호자들이 가입할 때 아이가 생기지 않는다.
 */
export interface CreateInvitationRequest {
  role?: MembershipRole; // 미지정 시 GUARDIAN
  email?: string; // email / phone 중 최소 하나 필수
  phone?: string;
}

/** 초대 생성 결과. 상대가 이미 회원이면 곧바로 멤버십이 만들어져 함께 내려온다. */
export interface CreateInvitationResponse {
  invitation: TenantInvitation;
  /** 기존 회원이라 즉시 소속 처리된 경우에만 존재한다. */
  membership?: TenantMembership;
}

export interface InvitationResponse {
  invitation: TenantInvitation;
}

/** 초대 링크를 연 사람에게 보여줄 최소 정보 (공개 조회 — 개인정보는 내리지 않는다). */
export interface InvitationPreview {
  tenantName: string;
  role: MembershipRole;
  petName: string | null;
  expiresAt: Date;
  status: string;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AcceptInvitationResponse {
  membership: TenantMembership;
  /** 초대에 아이 정보가 담겨 있었으면 함께 생성된 펫. */
  petId?: string;
}
