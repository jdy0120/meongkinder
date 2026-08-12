/** 반려동물 종 코드 ↔ 라벨 */
export const SPECIES_OPTIONS = [
  { value: "DOG", label: "강아지" },
  { value: "CAT", label: "고양이" },
  { value: "OTHER", label: "기타" },
] as const;

export const speciesLabelMap: Record<string, string> = Object.fromEntries(
  SPECIES_OPTIONS.map((option) => [option.value, option.label]),
);

/** 성별 코드 ↔ 라벨 */
export const GENDER_OPTIONS = [
  { value: "MALE", label: "수컷" },
  { value: "FEMALE", label: "암컷" },
] as const;

export const genderLabelMap: Record<string, string> = Object.fromEntries(
  GENDER_OPTIONS.map((option) => [option.value, option.label]),
);

/** 생년월일로부터 만 나이(년/개월) 라벨을 계산 */
export const calculateAgeLabel = (
  birthDate?: string | Date | null,
): string => {
  if (!birthDate) return "-";

  const birth = new Date(birthDate);
  const now = new Date();

  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return "-";

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return `${remainingMonths}개월`;
  if (remainingMonths === 0) return `${years}살`;
  return `${years}살 ${remainingMonths}개월`;
};
