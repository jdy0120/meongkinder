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

// 노출할 provider 목록. 콘솔 앱 키가 준비된 것만 남기거나 순서를 조정하면 된다.
export const SOCIAL_PROVIDERS_UI: SocialProviderMeta[] = [
  { slug: "kakao", label: "카카오로 계속하기" },
  { slug: "naver", label: "네이버로 계속하기" },
  { slug: "discord", label: "Discord로 계속하기" },
];
