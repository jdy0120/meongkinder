import type { SocialProviderSlug } from "@pawlog/shared";

// 소셜 로그인은 XHR 이 아니라 브라우저 전체 리다이렉트(OAuth) 로 동작하므로,
// 버튼은 API 의 authorize 엔드포인트로 향하는 <a href> 링크다.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const PROJECT = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "template-dev";

export const socialAuthUrl = (slug: SocialProviderSlug) =>
  `${API_BASE}/api/${PROJECT}/v1/auth/social/${slug}`;

export interface SocialProviderMeta {
  slug: SocialProviderSlug;
  label: string;
}

// job-036: 인증은 카카오 단일 경로다. 다른 provider 를 추가하려면 @pawlog/shared 의
// SOCIAL_PROVIDERS 와 apps/api 의 providerConfigs 에도 함께 등록해야 한다.
export const SOCIAL_PROVIDERS_UI: SocialProviderMeta[] = [
  { slug: "kakao", label: "카카오로 계속하기" },
];
