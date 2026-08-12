/**
 * 원생 안전 정보의 **긴급도 판정** (job-052, design-system.md §3.1).
 *
 * 런타임 값이므로 `types/contracts/` 가 아니라 여기에 둔다 — contracts 는 타입 전용으로
 * 컴파일 시 통째로 지워지고, 거기 선언한 const 는 조용히 사라진다.
 *
 * 이 파일이 왜 `packages/shared` 에 있는가: 같은 판정을 API(알림·집계)와 web(배지·테두리)이
 * 각각 구현하면 **양쪽이 다른 답을 낸다.** 특히 "만료 임박 D-14" 같은 경계값은 한쪽만 고치기
 * 쉬운데, 그러면 화면은 정상이라 하고 알림은 만료라 하는 상태가 된다.
 */

// ── 배지 레벨 ────────────────────────────────────────────────────────────────
//
// ⚠️ **3단계 외의 레벨을 추가하지 않는다.** 배지 색은 분류가 아니라 **긴급도만**
// 인코딩한다. 견종별·성향별로 색을 다르게 주기 시작하면 사용자는 색을 읽지 않고
// 글자만 읽게 되고, 그 순간 배지는 정보가 아니라 장식이 된다.

export const BADGE_LEVEL = {
  /** 확인 완료, 신경 쓸 필요 없음 — 접종 정상, 중성화 완료 */
  NORMAL: "normal",
  /** 오늘 신경 써야 함 — 알러지, 마킹 잦음, 접종 D-9, 분리불안 */
  CAUTION: "caution",
  /** 지금 조치 필요 — 종합백신 만료, 공격 이력, 미도착 */
  CRITICAL: "critical",
} as const;

export type BadgeLevel = (typeof BADGE_LEVEL)[keyof typeof BADGE_LEVEL];

// ── 예방접종 ────────────────────────────────────────────────────────────────

export const VACCINATION_TYPE = {
  COMPREHENSIVE: "comprehensive",
  RABIES: "rabies",
  KENNEL_COUGH: "kennel_cough",
  CORONA: "corona",
} as const;

export type VaccinationType =
  (typeof VACCINATION_TYPE)[keyof typeof VACCINATION_TYPE];

export const VACCINATION_TYPES = Object.values(VACCINATION_TYPE);

export const VACCINATION_TYPE_LABEL: Record<string, string> = {
  [VACCINATION_TYPE.COMPREHENSIVE]: "종합백신",
  [VACCINATION_TYPE.RABIES]: "광견병",
  [VACCINATION_TYPE.KENNEL_COUGH]: "켄넬코프",
  [VACCINATION_TYPE.CORONA]: "코로나",
};

export const VACCINATION_STATUS = {
  VALID: "valid",
  /** 만료 D-14 이내 */
  EXPIRING_SOON: "expiring_soon",
  EXPIRED: "expired",
} as const;

export type VaccinationStatus =
  (typeof VACCINATION_STATUS)[keyof typeof VACCINATION_STATUS];

/** 만료 임박으로 볼 기간(일). 접종은 예약 후 접종까지 시간이 걸려 2주가 실무적 하한이다. */
export const VACCINATION_EXPIRING_SOON_DAYS = 14;

/** `Pet.vaccinations` JSON 한 칸의 모양. 상태는 **저장하지 않는다**(아래 참고). */
export interface VaccinationRecord {
  type: string;
  /** ISO 날짜 (YYYY-MM-DD) */
  expiresAt: string;
}

/** 상태까지 계산해 붙인 형태. 화면·알림은 이걸 쓴다. */
export interface ResolvedVaccination extends VaccinationRecord {
  status: VaccinationStatus;
  /** 만료까지 남은 일수. 음수면 이미 지났다. */
  daysLeft: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 접종 상태를 **조회 시점에** 계산한다.
 *
 * 상태를 컬럼에 저장하지 않는 이유: 날짜가 지나도 저장된 값은 갱신되지 않으므로
 * "이미 만료됐는데 화면에는 정상으로 보이는" 실패가 난다. 안전 정보에서 그건
 * 정보가 없는 것보다 나쁘다 — 원장이 확인했다고 믿게 만들기 때문이다.
 */
export const resolveVaccination = (
  record: VaccinationRecord,
  now: Date = new Date(),
): ResolvedVaccination => {
  // 날짜만 비교한다. 시각까지 넣으면 만료 당일 오전/오후에 답이 달라진다.
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = Date.parse(`${record.expiresAt.slice(0, 10)}T00:00:00Z`);

  if (Number.isNaN(expiry)) {
    // 날짜를 못 읽으면 **만료로 본다.** 안전 정보의 기본값은 안전한 쪽이어야 한다.
    return { ...record, status: VACCINATION_STATUS.EXPIRED, daysLeft: 0 };
  }

  const daysLeft = Math.round((expiry - today) / MS_PER_DAY);

  const status =
    daysLeft < 0
      ? VACCINATION_STATUS.EXPIRED
      : daysLeft <= VACCINATION_EXPIRING_SOON_DAYS
        ? VACCINATION_STATUS.EXPIRING_SOON
        : VACCINATION_STATUS.VALID;

  return { ...record, status, daysLeft };
};

/** JSON 컬럼(무엇이든 들어올 수 있다)을 안전하게 레코드 배열로 읽는다. */
export const parseVaccinations = (value: unknown): VaccinationRecord[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { type, expiresAt } = item as Record<string, unknown>;
    if (typeof type !== "string" || typeof expiresAt !== "string") return [];
    return [{ type, expiresAt }];
  });
};

/**
 * 접종 전체의 긴급도. 하나라도 만료면 `critical`, 임박이 있으면 `caution`.
 *
 * ⚠️ 기록이 **아예 없으면 `caution`** 이다. `normal` 로 두면 "접종을 확인했고 문제없다"와
 * "아무도 확인한 적이 없다"가 화면에서 같아 보인다. 후자는 확인이 필요한 상태다.
 */
export const resolveVaccinationLevel = (
  records: VaccinationRecord[],
  now: Date = new Date(),
): BadgeLevel => {
  if (records.length === 0) return BADGE_LEVEL.CAUTION;

  const statuses = records.map((r) => resolveVaccination(r, now).status);

  if (statuses.includes(VACCINATION_STATUS.EXPIRED)) return BADGE_LEVEL.CRITICAL;
  if (statuses.includes(VACCINATION_STATUS.EXPIRING_SOON))
    return BADGE_LEVEL.CAUTION;

  return BADGE_LEVEL.NORMAL;
};

/** 아이 한 마리의 긴급도를 매기는 데 필요한 최소 정보. Prisma `Pet` 이 그대로 만족한다. */
export interface PetSafetyInput {
  allergies: string[];
  temperaments: string[];
  marksIndoors: boolean | null;
  mountingBehavior: boolean | null;
  hasBiteHistory: boolean | null;
  vaccinations: unknown;
}

/**
 * 아이 한 마리의 긴급도 (design-system.md §6.1).
 *
 * `critical` 조건은 **두 개뿐**이다 — 접종 만료, 공격 이력. 이 둘만 카드 테두리를
 * 승격시킨다. 배지 하나로는 스크롤 중에 놓치기 때문이다.
 *
 * ⚠️ 이 함수가 `packages/shared` 에 있는 이유: 같은 판정을 화면(테두리·필터 칩)과
 * 서버(필터 개수 집계)가 각각 구현하면 **칩에 "주의 5"라고 써 놓고 눌렀을 때 3마리만
 * 나오는** 상태가 된다. 사용자는 그걸 버그로 인식하지 못하고 그냥 목록을 못 믿게 된다.
 */
export const resolvePetSafetyLevel = (
  pet: PetSafetyInput,
  now: Date = new Date(),
): BadgeLevel => {
  const records = parseVaccinations(pet.vaccinations);
  const vaccinationLevel = resolveVaccinationLevel(records, now);

  const hasExpired = records.some(
    (record) => resolveVaccination(record, now).status === VACCINATION_STATUS.EXPIRED,
  );

  if (hasExpired || pet.hasBiteHistory) return BADGE_LEVEL.CRITICAL;

  if (
    vaccinationLevel === BADGE_LEVEL.CAUTION ||
    pet.allergies.length > 0 ||
    pet.temperaments.length > 0 ||
    pet.marksIndoors ||
    pet.mountingBehavior
  ) {
    return BADGE_LEVEL.CAUTION;
  }

  return BADGE_LEVEL.NORMAL;
};

// ── 픽업 ────────────────────────────────────────────────────────────────────

export const PICKUP_METHOD = {
  GUARDIAN: "GUARDIAN",
  SHUTTLE: "SHUTTLE",
} as const;

export type PickupMethod = (typeof PICKUP_METHOD)[keyof typeof PICKUP_METHOD];

export const PICKUP_METHODS = Object.values(PICKUP_METHOD);

// ── 적응 기간 ────────────────────────────────────────────────────────────────

/**
 * 적응 N일차. 시작일만 저장하고 일수는 계산한다 — 일수를 저장하면 매일 배치가 필요하다.
 * `null` 이면 적응 기간이 아니다.
 */
export const resolveAdaptationDay = (
  startedAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null => {
  if (!startedAt) return null;

  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;

  const startDay = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const day = Math.floor((today - startDay) / MS_PER_DAY) + 1; // 시작일이 1일차

  // 적응 기간은 통상 2주. 그보다 오래되면 "적응 완료"로 보고 배지를 지운다 —
  // 원장이 시작일을 지우는 걸 잊어도 "적응 60일차" 같은 문구가 남지 않는다.
  if (day < 1 || day > 14) return null;

  return day;
};
