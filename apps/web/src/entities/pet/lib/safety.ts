import {
  parseVaccinations,
  resolveAdaptationDay,
  resolvePetSafetyLevel,
  resolveVaccination,
  resolveVaccinationLevel,
  VACCINATION_STATUS,
  VACCINATION_TYPE_LABEL,
  type BadgeLevel,
  type PetSafetyInput,
  type ResolvedVaccination,
} from "@pawlog/shared";

/**
 * 카드 표면에 올릴 안전 정보를 한 번에 계산한다 (design-system.md §6.1).
 *
 * 판정 규칙 자체는 `@pawlog/shared/pet-safety` 에 있다 — API(알림·집계)와 web(배지·테두리)이
 * 같은 답을 내야 하기 때문. 여기 있는 것은 **"그래서 카드에 뭘 그리는가"** 뿐이다.
 */

/** 카드에 그릴 안전 정보를 갖고 있으면 되는 최소 모양. Prisma `Pet` 이 그대로 만족한다. */
export interface PetSafetySource extends PetSafetyInput {
  adaptationStartedAt: Date | string | null;
}

export interface PetSafety {
  vaccinations: ResolvedVaccination[];
  vaccinationLevel: BadgeLevel;
  /** 지금 만료된 접종. 있으면 카드 테두리를 승격시킨다. */
  expiredVaccinations: ResolvedVaccination[];
  /** 만료 임박(D-14) 중 가장 급한 것. 배지에 D-N 으로 적는다. */
  soonestExpiring: ResolvedVaccination | null;
  adaptationDay: number | null;
  /**
   * 이 아이 전체의 긴급도. 카드 정렬이 아니라 **테두리 승격**과 필터("주의 N")에 쓴다.
   *
   * `critical` 조건은 두 개뿐이다 — 접종 만료, 공격 이력. 배지 하나로는 스크롤 중에
   * 놓치므로 이 둘만 카드 테두리 자체를 승격시킨다(§6.1).
   */
  level: BadgeLevel;
}

export const resolvePetSafety = (
  pet: PetSafetySource,
  now: Date = new Date(),
): PetSafety => {
  const records = parseVaccinations(pet.vaccinations);
  const vaccinations = records.map((record) => resolveVaccination(record, now));

  const expiredVaccinations = vaccinations.filter(
    (v) => v.status === VACCINATION_STATUS.EXPIRED,
  );

  const soonestExpiring =
    vaccinations
      .filter((v) => v.status === VACCINATION_STATUS.EXPIRING_SOON)
      .sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null;

  return {
    vaccinations,
    vaccinationLevel: resolveVaccinationLevel(records, now),
    expiredVaccinations,
    soonestExpiring,
    adaptationDay: resolveAdaptationDay(pet.adaptationStartedAt, now),
    // 판정 자체는 @pawlog/shared 가 한다 — 서버의 "주의 N" 집계와 반드시 같은 답이어야
    // 칩을 눌렀을 때 개수가 맞는다.
    level: resolvePetSafetyLevel(pet, now),
  };
};

/** "종합백신" 같은 사람이 읽는 이름. 모르는 코드는 그대로 보여준다(숨기면 더 헷갈린다). */
export const vaccinationLabel = (type: string): string =>
  VACCINATION_TYPE_LABEL[type] ?? type;

/**
 * 픽업 시각 표시. 값이 없으면 "미정"이다 — 빈칸으로 두면 "오늘 안 오는 아이"와
 * "시각을 아직 안 넣은 아이"가 화면에서 같아 보인다.
 */
export const formatPickupTime = (pickupTime: string | null): string =>
  pickupTime ?? "미정";

/** "셔틀 2호차" / "보호자 직접". 수단을 안 넣었으면 아무것도 그리지 않는다. */
export const formatPickupMethod = (
  pickupMethod: string | null,
  shuttleNumber: number | null,
): string | null => {
  if (pickupMethod === "SHUTTLE") {
    return shuttleNumber ? `셔틀 ${shuttleNumber}호차` : "셔틀";
  }
  if (pickupMethod === "GUARDIAN") return "보호자 직접";
  return null;
};
