import { PHOTO_CONSENT } from "@pawlog/shared";

/**
 * 초상권 동의 범위 선택지.
 *
 * 단체 사진에 남의 아이가 함께 찍히는 구조라, 이 설정은 "우리 아이 사진을 누가 보는가"가
 * 아니라 "우리 아이가 남의 알림장에 나가도 되는가"에 가깝다. 그래서 문구를 그 관점으로 쓴다.
 */
export const PHOTO_CONSENT_OPTIONS = [
  {
    value: PHOTO_CONSENT.PRIVATE,
    label: "비공개",
    description:
      "우리 아이 사진은 저에게만 보여주세요. 다른 아이와 함께 찍힌 사진에는 태그되지 않습니다.",
  },
  {
    value: PHOTO_CONSENT.CLASS,
    label: "같은 반",
    description:
      "함께 노는 아이들의 보호자까지 볼 수 있어요. 단체 사진에 함께 나올 수 있습니다.",
  },
  {
    value: PHOTO_CONSENT.PUBLIC,
    label: "유치원 전체",
    description: "유치원 홍보·마케팅 활용까지 동의합니다.",
  },
] as const;

export const photoConsentLabel = (value: string) =>
  PHOTO_CONSENT_OPTIONS.find((option) => option.value === value)?.label ??
  value;

/** 다른 아이와 함께 찍힌 사진에 태그할 수 있는지 — 태그 화면에서 회색 처리 판정에 쓴다. */
export const canTagInGroupPhoto = (photoConsent: string) =>
  photoConsent !== PHOTO_CONSENT.PRIVATE;
