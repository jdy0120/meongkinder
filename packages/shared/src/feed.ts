// 피드 도메인 상수 (api·web 공통) — job-034.
// 런타임 값이므로 types/contracts 가 아니라 src 에 둔다 (types/ 는 `export type *` 로만 재노출되어
// 상수가 조용히 지워진다).

/**
 * 초상권 동의 범위 (Pet.photoConsent).
 *
 * 단체 사진 한 장에 여러 아이가 함께 찍히는 구조라, "이 아이가 나온 사진을 누구까지 볼 수
 * 있는가"를 아이별로 갖고 있어야 한다. 가입 시 보호자가 고르고 업로드/태그 화면이 이를 반영한다.
 */
export const PHOTO_CONSENT = {
  /** 본인 보호자만. 이 아이가 태그된 게시물은 다른 보호자의 피드에 나타나지 않는다. */
  PRIVATE: "PRIVATE",
  /** 같은 원 보호자들 (기본값) — 합사해서 노는 아이들끼리. */
  CLASS: "CLASS",
  /** 유치원 전체 + 마케팅 활용까지 허용. */
  PUBLIC: "PUBLIC",
} as const;

export type PhotoConsent = (typeof PHOTO_CONSENT)[keyof typeof PHOTO_CONSENT];

export const PHOTO_CONSENTS = [
  PHOTO_CONSENT.PRIVATE,
  PHOTO_CONSENT.CLASS,
  PHOTO_CONSENT.PUBLIC,
] as const;

export const isPhotoConsent = (value: string): value is PhotoConsent =>
  (PHOTO_CONSENTS as readonly string[]).includes(value);

/** 게시물 상태. DRAFT 는 보호자에게 보이지 않으며, PUBLISHED 시점에 팬아웃 알림이 나간다. */
export const FEED_POST_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export type FeedPostStatus =
  (typeof FEED_POST_STATUS)[keyof typeof FEED_POST_STATUS];

export const FEED_MEDIA_TYPE = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
} as const;

export type FeedMediaType =
  (typeof FEED_MEDIA_TYPE)[keyof typeof FEED_MEDIA_TYPE];

/** 태그가 AI 제안에서 왔는지, 사람이 직접 넣었는지. 정확도 측정의 분모/분자가 된다. */
export const FEED_TAG_SOURCE = {
  AI: "AI",
  MANUAL: "MANUAL",
} as const;

export type FeedTagSource =
  (typeof FEED_TAG_SOURCE)[keyof typeof FEED_TAG_SOURCE];

/** AI 제안에 대한 사람의 판정 — 그대로 학습 데이터가 된다. */
export const FEED_TAG_CORRECTION_ACTION = {
  /** AI 가 놓친 아이를 사람이 추가 (거짓 음성) */
  ADDED: "ADDED",
  /** AI 오인식을 사람이 제거 (거짓 양성) */
  REMOVED: "REMOVED",
  /** AI 제안을 사람이 그대로 인정 (참 양성) */
  CONFIRMED: "CONFIRMED",
} as const;

export type FeedTagCorrectionAction =
  (typeof FEED_TAG_CORRECTION_ACTION)[keyof typeof FEED_TAG_CORRECTION_ACTION];

/**
 * AI 태그 제안을 사람 확인 없이 신뢰할 수 있는 최소 확신도.
 * 이보다 낮으면 화면에서 "이 아이 맞나요?" 확인을 받는다 — 인스타도 얼굴 태그는 제안만 한다.
 * 목표는 100% 정확도가 아니라 "손으로 다 태그하는 것보다 빠른 것"이다.
 */
export const FEED_TAG_CONFIDENCE_THRESHOLD = 0.7;

/** 영상 길이 상한(초). 스토리지 원가와 업로드 실패율을 함께 누르는 값이다. */
export const FEED_VIDEO_MAX_SECONDS = 15;
