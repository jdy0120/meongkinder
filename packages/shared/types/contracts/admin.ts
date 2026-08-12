// 관리자 도메인 API 계약
import type {
  TenantSubscription,
  SubscriptionPlan,
  UserTermsAgreement,
  Terms,
  Prisma,
} from "@pawlog/database";
import type { BadgeLevel } from "../../src/pet-safety";
import type { CreatePetRequest } from "./pet";
import type { SafeUser } from "../models/auth/user";

// 회원 계정 수정/역할 변경 계약은 제거했다 (매장용 `v1/admin/users*` 삭제).
// 매장 안에서의 역할은 멤버십 계약(`contracts/membership.ts`)이 담당하고, 계정 상태
// 변경은 플랫폼 계약(`contracts/platform.ts`)이 담당한다.

// job-020: 구독 주체가 User -> Tenant 로 이동.
export interface TenantSubscriptionDetail extends TenantSubscription {
  tenant: {
    name: string;
    subdomain: string;
  };
  plan: SubscriptionPlan;
}

export interface UserWithAgreements extends SafeUser {
  termsAgreements?: (UserTermsAgreement & {
    terms: Terms;
  })[];
}

export interface CreateTermsRequest {
  title: string;
  type: string;
  version: string;
  isRequired: boolean;
  isActive: boolean;
  fileId?: string;
}

export interface CreateTermsResponse {
  terms: Terms;
}

export interface UpdateTermsActiveRequest {
  isActive: boolean;
}

export interface UpdateTermsActiveResponse {
  terms: Terms;
}

// 반려동물(펫) 소유자 정보를 포함한 어드민 조회용 확장 타입
/**
 * 원생 + 보호자 계정 (`v1/admin/pets` 목록·상세).
 *
 * ⚠️ **관계 모양을 손으로 쓰지 않고 Prisma 에서 유도한다** (job-044).
 *
 * 예전에는 `user: { email; nickname }` 라고 직접 적어 두었는데, `Pet.userId` 가
 * nullable 이 된 뒤에도(job-040: 매장이 전화번호만으로 등록한 원생) 이 칸은 non-nullable
 * 인 채로 남았다. 계약이 거짓말을 하니 **타입 검사는 통과하고 런타임만 깨져서**, 계정
 * 미연결 원생이 하나라도 있는 매장에서 `pet.user.nickname` 이 TypeError 를 내며 원생
 * 목록과 리포트 작성 화면이 통째로 렌더 실패했다. SSR 은 200 이라 서버 로그에도 남지
 * 않았다.
 *
 * `GetPayload` 로 유도하면 스키마의 nullable 여부가 타입에 자동으로 따라붙는다 —
 * 다음에 누가 관계를 optional 로 바꿔도 계약이 저절로 맞고, 화면 쪽 `tsc` 가 즉시 깨진다.
 * **새 계약에서 관계를 실을 때는 이 방식을 쓸 것.**
 */
export type PetWithOwner = Prisma.PetGetPayload<{
  include: {
    user: { select: { email: true; nickname: true } };
    /**
     * job-052: **오늘의 출석 0건 또는 1건.** 원생 목록의 필터 칩("등원 중 / 등원 예정 /
     * 하원 완료")이 전부 오늘의 출석 상태이고, 카드의 등원 처리 버튼도 이 `id` 로 부른다.
     *
     * ⚠️ 배열이다. `take: 1` 이라 최대 1개지만 Prisma 는 관계를 배열로 준다 —
     * `pet.attendances[0]` 이 `undefined` 일 수 있다는 뜻이고(오늘 스케줄이 아닌 아이),
     * 그 경우가 정상이다.
     */
    attendances: {
      select: {
        id: true;
        status: true;
        checkInAt: true;
        checkOutAt: true;
      };
    };
  };
}> & {
  /**
   * 정기권 잔여 (job-052). 관계가 아니라 **집계값**이라 `GetPayload` 로 유도할 수 없어
   * 여기서만 손으로 쓴다 — 서버가 원장(ledger) 마지막 줄의 `balanceAfter` 를 붙여 준다.
   *
   * `null` 은 "이용권을 판 적이 없음"이고 `0` 은 "다 써서 없음"이다. 둘을 합치면 원장이
   * 충전이 필요한 아이와 아직 안 판 아이를 구분할 수 없다.
   */
  passRemaining: number | null;
};

// ── 매장 대시보드 (job-052, design-system.md §6.2) ───────────────────────────
//
// 블록 순서는 '중요도'가 아니라 **"지금 안 보면 되돌릴 수 없는 정도 × 오전에만 대응
// 가능한 정도"** 로 정해져 있고, 그 순서가 이 타입의 필드 순서다.

export interface DashboardAttentionReason {
  /** 색은 긴급도만 인코딩한다 (§3.1). 3단계 외의 값은 없다. */
  level: BadgeLevel;
  label: string;
}

export interface DashboardResponse {
  /** 1순위 — 미도착은 즉시 보호자 확인 전화로 이어져야 하므로 **이름까지** 온다. */
  attendance: {
    checkedIn: number;
    checkedOut: number;
    total: number;
    scheduled: { id: string; name: string; pickupTime: string | null }[];
    absent: { id: string; name: string }[];
  };
  /** 2순위 — 오늘 오는 아이 중 신경 써야 하는 아이. critical 이 먼저 온다. */
  attention: {
    id: string;
    name: string;
    level: BadgeLevel;
    reasons: DashboardAttentionReason[];
  }[];
  /**
   * 3순위 — 안전과 직결. 단순 출근 인원이 아니라 **비율**이어야 판단 기준이 된다
   * ("3명"은 많은 건지 적은 건지 알 수 없다). 구성원이 0명이면 `petsPerStaff` 는 null.
   */
  staffing: {
    staffCount: number;
    petCount: number;
    petsPerStaff: number | null;
  };
  /** 4순위 — 오후 혼잡 구간을 오전에 미리 알아야 배치를 조정할 수 있다. */
  pickup: {
    hours: { hour: string; count: number }[];
    shuttles: { number: number; count: number }[];
    /** 픽업 시각 미입력 두수. 타임라인이 조용히 틀리는 유일한 원인이라 밝힌다. */
    unsetCount: number;
  };
  /**
   * 5순위 — 시간 민감도가 가장 낮다(하원 때 보호자를 만나며 말하면 된다).
   *
   * ⚠️ 스펙의 "미결제 건수"는 없다. 이 스키마의 매출(`TenantSale`)은 **돈을 받은 시점에만**
   * 생기고 외상/미수금 개념이 없어서다. 0으로 그리면 "미결제가 없다"고 읽히는데 그건
   * 거짓이라 아예 내려주지 않는다.
   */
  passes: {
    lowBalance: { petId: string; name: string; balance: number }[];
  };
}

/**
 * 원생 목록 필터 칩의 개수 (job-052, design-system.md §6.1).
 * 앞의 넷은 **오늘의 출석** 기준, `attention` 은 안전 정보 기준이라 성격이 다르다.
 */
export interface PetSummaryResponse {
  present: number; // 등원 중
  scheduled: number; // 등원 예정
  checkedOut: number; // 하원 완료
  absent: number; // 미도착 — 보호자 확인 전화로 바로 이어져야 한다
  attention: number; // 주의 (접종 만료/임박·알러지·성향·마킹·공격 이력)
  total: number; // 이용중(ACTIVE) 원생 전체
}

// 어드민 반려동물 등록 — 보호자(사용자) ID 를 직접 지정한다는 점에서 일반 등록 요청과 다르다.
export interface AdminCreatePetRequest extends CreatePetRequest {
  userId: string;
}
