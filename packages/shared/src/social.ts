// 소셜 로그인 provider (api·web 공통)
// role(ROLES) 과 동일하게 Prisma enum 이 아닌 문자열 상수로 관리한다.
// provider 를 추가할 때 여기 한 곳만 수정하면 되고 DB 마이그레이션이 필요 없다.
export const SOCIAL_PROVIDERS = {
  KAKAO: "KAKAO",
  NAVER: "NAVER",
  DISCORD: "DISCORD",
} as const;

export type SocialProvider =
  (typeof SOCIAL_PROVIDERS)[keyof typeof SOCIAL_PROVIDERS];

// 라우트 파라미터(소문자)와 저장/식별용 상수(대문자) 사이 변환 헬퍼.
// 예: URL 은 /v1/auth/kakao, DB provider 는 "KAKAO".
export const SOCIAL_PROVIDER_SLUGS = {
  kakao: SOCIAL_PROVIDERS.KAKAO,
  naver: SOCIAL_PROVIDERS.NAVER,
  discord: SOCIAL_PROVIDERS.DISCORD,
} as const;

export type SocialProviderSlug = keyof typeof SOCIAL_PROVIDER_SLUGS;

export const isSocialProviderSlug = (
  value: string,
): value is SocialProviderSlug => value in SOCIAL_PROVIDER_SLUGS;

// ── 소셜 제공자별 원본(Raw) 프로필 응답 타입 ──────────────────────────────────
export interface KakaoProfileResponse {
  id?: string | number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

export interface NaverProfileResponse {
  response?: {
    id?: string;
    email?: string;
    nickname?: string;
    name?: string;
    profile_image?: string;
  };
}

export interface DiscordProfileResponse {
  id?: string;
  email?: string;
  username?: string;
  global_name?: string;
  avatar?: string;
}
