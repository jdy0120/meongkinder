export {
  SPECIES_OPTIONS,
  GENDER_OPTIONS,
  speciesLabelMap,
  genderLabelMap,
  calculateAgeLabel,
} from "./lib/options";
// job-052: 안전 정보 판정 (design-system.md §6.1). 판정 규칙 자체는 @pawlog/shared 에 있고
// 여기 있는 것은 "그래서 카드에 뭘 그리는가" 뿐이다.
export {
  resolvePetSafety,
  vaccinationLabel,
  formatPickupTime,
  formatPickupMethod,
} from "./lib/safety";
export type { PetSafety, PetSafetySource } from "./lib/safety";
export { usePets } from "./model/usePets";
export { usePet } from "./model/usePet";
export { usePetOptions } from "./model/usePetOptions";
export { PetAvatar } from "./ui/PetAvatar";
export { DogCard } from "./ui/DogCard";
export {
  LevelBadge,
  VaccinationBadge,
  AllergyBadge,
  TemperamentBadges,
  MarkingBadges,
  NeuteredBadge,
  AdaptationBadge,
  PassBalanceBadge,
} from "./ui/SafetyBadges";
