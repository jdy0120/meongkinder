import type { Pet } from "@pawlog/database";
import type { VaccinationRecord } from "../../src/pet-safety";
import type { BusinessHours } from "./tenant";

export interface PickupAuthorizedPerson {
  name: string;
  phone: string;
  relation?: string; // 관계 (예: 아빠, 이모, 조부모)
}

export interface CreatePetRequest {
  name: string;
  species: string; // 종 (예: DOG, CAT)
  breed?: string;
  birthDate?: string; // ISO 8601
  gender?: string; // MALE | FEMALE
  isNeutered?: boolean;
  weightKg?: number;
  profileImageFileId?: string;
  careNote?: string; // 자유 서술. 아래 구조화 필드에 담기지 않는 것만 (투약 방법, 보호자 당부 등)

  // ── 안전 정보 (job-052) ────────────────────────────────────────────
  // 카드 표면에 올리고 필터를 걸어야 하므로 careNote 자유 텍스트에서 꺼낸 것들이다.
  allergies?: string[]; // 예: ["닭고기"]
  temperaments?: string[]; // **상황 서술**로 적는다. "소심함" ✗ / "대형견 무서워함" ○
  marksIndoors?: boolean; // 실내 마킹
  mountingBehavior?: boolean; // 마운팅
  hasBiteHistory?: boolean; // 공격/입질 이력 — 이것만 긴급도가 critical 이다
  vaccinations?: VaccinationRecord[]; // 만료/임박 판정은 저장하지 않고 조회 시 계산한다
  adaptationStartedAt?: string; // ISO 날짜. 있으면 "적응 N일차"를 계산한다

  // ── 픽업 (job-052) — 원생 목록의 기본 정렬 키 ────────────────────────
  pickupTime?: string; // "HH:mm" (KST)
  pickupMethod?: string; // GUARDIAN | SHUTTLE — @pawlog/shared PICKUP_METHOD
  shuttleNumber?: number; // pickupMethod 가 SHUTTLE 일 때만 의미가 있다

  guardianName?: string; // 보호자 이름
  guardianPhone?: string; // 보호자 연락처
  emergencyContactName?: string; // 비상 연락처 이름
  emergencyContactPhone?: string; // 비상 연락처 전화번호
  pickupAuthorizedPersons?: PickupAuthorizedPerson[]; // 픽업 권한자 목록
  scheduleType?: string; // 등원 스케줄 방식 (WEEKLY 기본 | MONTHLY) — @pawlog/shared SCHEDULE_TYPE
  scheduleDays?: number[]; // 요일별 등원 스케줄 (0=일 ~ 6=토). scheduleType 이 WEEKLY 일 때만 읽는다
  photoConsent?: string; // 초상권 동의 범위 (PRIVATE | CLASS 기본 | PUBLIC) — @pawlog/shared PHOTO_CONSENT
}

export type UpdatePetRequest = Partial<CreatePetRequest>;

export interface PetResponse {
  pet: Pet;
}

// ── 등원 (job-033) ────────────────────────────────────
// 펫은 항상 보호자 소유이고, 유치원 소속은 별개의 조작이다.
// 보호자가 ACTIVE GUARDIAN 으로 소속된 테넌트에만 등록할 수 있다.

export interface EnrollPetRequest {
  tenantId: string;
}

export interface EnrollPetResponse {
  pet: Pet;
}

/** 등원 해지 — 펫의 tenantId 를 null 로 되돌린다. 출석/리포트 이력은 테넌트에 남는다. */
export interface UnenrollPetResponse {
  pet: Pet;
}

// ── 원생 등록 단일 진입점 (job-040) ──────────────────────────────────
// 원장은 등록을 시작할 때 "이 보호자가 가입했는지"를 모른다. 아는 것은 전화번호뿐이다.
// 그래서 화면을 두 개(회원용 펫 등록 / 비회원용 초대장)로 나누지 않고, 번호를 먼저 받아
// **서버가 갈라준다**. 상태 값은 @pawlog/shared 의 PET_INTAKE_* 상수를 쓴다.

/** 등록 후보로 보여줄 아이 (보호자가 이미 등록해 둔 아이) */
export interface PetIntakeCandidatePet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  /** 이미 우리 매장 원생인지 — true 면 다시 등록할 수 없다(선택 불가로 표시). */
  enrolled: boolean;
}

export interface PetIntakeLookupResponse {
  /** PET_INTAKE_GUARDIAN_STATUS */
  status: string;
  /** 회원일 때만. 이름 확인용 최소 정보이며 이메일은 내려주지 않는다. */
  guardian: { id: string; nickname: string } | null;
  /** 우리 매장에서의 멤버십 상태(ACTIVE/PENDING/…). 구성원이 아니면 null. */
  membershipStatus: string | null;
  /** 우리 매장 구성원일 때만 채워진다. 그 외에는 언제나 빈 배열. */
  pets: PetIntakeCandidatePet[];
}

export interface PetIntakeRequest {
  /** 하이픈 유무 무관. 서버에서 숫자만 남겨 정규화한다. */
  phone: string;
  guardianName?: string;
  /** 기존 아이를 우리 매장 원생으로 받을 때. `pet` 과 동시에 보낼 수 없다. */
  petId?: string;
  /** 새 아이를 등록할 때. `petId` 와 동시에 보낼 수 없다. */
  pet?: CreatePetRequest;
}

export interface PetIntakeResponse {
  /** PET_INTAKE_MODE */
  mode: string;
  pet: Pet;
  /** 이번 호출로 멤버십이 새로 만들어졌는지 (원장에게 안내 문구가 달라진다) */
  membershipCreated: boolean;
  /** 미가입 보호자였다면 남겨진 초대장 id. 가입 시 이 초대가 계정을 연결한다. */
  invitationId: string | null;
}

// ── 등원 스케줄 (job-053) ────────────────────────────────────────────
// 스케줄은 펫 수정(`PATCH v1/admin/pets/:id`)과 분리된 자기 엔드포인트를 쓴다.
// 날짜 지정(MONTHLY)의 편집 단위가 **한 달**이라서다 — 펫 페이로드에 날짜 배열을 통째로
// 실으면 8월 달력을 고치는 요청이 9월 예정일까지 지워 버린다. `month` 를 함께 받아
// "이 달만 이걸로 교체"를 명시한다.

/** `"YYYY-MM-DD"` 로컬 날짜 문자열. `Date` 를 실으면 UTC 변환으로 하루가 밀린다. */
export type DateKey = string;

export interface PetScheduleResponse {
  /** SCHEDULE_TYPE */
  scheduleType: string;
  /** WEEKLY 일 때의 요일 패턴 (0=일 ~ 6=토) */
  scheduleDays: number[];
  /** 조회한 달 (`"YYYY-MM"`) */
  month: string;
  /**
   * 그 달의 등원 예정일.
   *   WEEKLY  → 요일 패턴에서 계산한 날짜 (DB 에 행이 없다. 미리보기다)
   *   MONTHLY → 저장된 `PetSchedule` 행
   */
  dates: DateKey[];
}

export interface UpdatePetScheduleRequest {
  /** SCHEDULE_TYPE */
  scheduleType: string;
  /** WEEKLY 일 때만 반영. 빈 배열이면 "등원일 없음"으로 저장된다. */
  scheduleDays?: number[];
  /** MONTHLY 일 때 필수 — 교체 대상 달 (`"YYYY-MM"`). */
  month?: string;
  /** MONTHLY 일 때 그 달의 등원일 전체. 빈 배열이면 그 달을 비운다. */
  dates?: DateKey[];
}

// ── 등원 예약 (job-060) ──────────────────────────────────────────────
//
// **보호자가** 매장 운영일 중에서 아이가 갈 날을 직접 고른다. 저장되는 곳은 위와 같은
// `PetSchedule` 이다(`source = "GUARDIAN"`) — 담는 사실이 "이 아이가 이 날 온다"로
// 완전히 같아서, 나누면 그 사실을 읽는 네 곳(출석부 자동 생성 · 피드 커버리지 · 태그
// 후보 · 등원 알림)이 전부 두 테이블을 합쳐 읽어야 한다.
//
// ⚠️ **예약은 이용권을 차감하지 않는다.** 차감은 등원 체크 한 곳에서만 일어난다. 예약
// 가능 여부는 `잔액 − 오늘 이후 예약 수` 로 판정한다 — 자세한 이유는
// `packages/shared/src/reservation.ts` 의 주석에 있다.

/** 예약 달력의 하루. 서버가 이미 판정을 끝내서 내려주므로 화면은 그리기만 한다. */
export interface ReservationDay {
  date: DateKey;
  /** 매장이 이 요일에 문을 여는가 */
  open: boolean;
  /** 그 날 운영시간 표기(`"09:00 ~ 19:00 (휴게 13:00~14:00)"`). 휴무면 `null`. */
  hours: string | null;
  /** 이미 등원 예정인 날 (보호자 예약 + 원장이 지정한 등원일) */
  reserved: boolean;
  /**
   * 보호자가 이 예약을 취소할 수 있는가.
   *
   * 원장이 짜 넣은 등원일(`source = "ADMIN"`)은 `reserved` 지만 `cancelable` 은
   * `false` 다 — 보호자가 지우면 매장 운영 계획이 말없이 바뀐다.
   */
  cancelable: boolean;
  /** 이미 등원 체크가 끝난 날 (취소 불가) */
  attended: boolean;
  /** 선택 불가 사유 (`RESERVATION_BLOCK`). `null` 이면 예약할 수 있다. */
  blockedBy: string | null;
  /**
   * 임시 휴무 사유 — 매장이 적어 둔 문구 (job-060).
   *
   * 사유 없이 잠그기만 하면 보호자는 매장에 전화한다. "설 연휴"·"정기 소독"이면 전화가
   * 필요 없다. `blockedBy === "TEMPORARILY_CLOSED"` 일 때만 값이 있고, 매장이 사유를
   * 비워 뒀으면 `null` 이다.
   */
  closedReason: string | null;
}

export interface ReservationCalendarResponse {
  petId: string;
  petName: string;
  /** 조회한 달 (`"YYYY-MM"`) */
  month: string;
  /** 아이가 소속된 매장. 없으면(=미등록) 어떤 날도 예약할 수 없다. */
  tenant: { id: string; name: string; subdomain: string } | null;
  /**
   * 매장 운영시간. `null` 은 "매장이 등록하지 않았다"이며 이때 달력은 전부 잠긴다 —
   * 어느 날이 운영일인지 알 수 없는데 열어 두면 보호자가 휴무일에 아이를 데려온다.
   */
  businessHours: BusinessHours | null;
  /** 이용권 잔여 횟수 (`SubscriptionLedger` 마지막 줄) */
  balance: number;
  /** 오늘 이후로 이미 잡혀 있는 등원 예정일 수 */
  reservedAhead: number;
  /** 더 잡을 수 있는 횟수 = `balance - reservedAhead` (음수는 0으로 깎는다) */
  remaining: number;
  days: ReservationDay[];
}

/** 예약 추가. 여러 날을 한 번에 보낼 수 있고, **하나라도 막히면 전부 거절**한다. */
export interface CreateReservationRequest {
  dates: DateKey[];
}

export interface CreateReservationResponse {
  /** 이번 호출로 새로 잡힌 날짜 */
  created: DateKey[];
  /** 반영 후 남은 예약 가능 횟수 */
  remaining: number;
}
