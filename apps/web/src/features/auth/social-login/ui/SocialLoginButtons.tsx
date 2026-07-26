"use client";

import { Button } from "@pawlog/ui";

import { SOCIAL_PROVIDERS_UI, socialAuthUrl } from "../model/providers";

/**
 * 소셜 로그인 버튼 묶음 (feature ui).
 * 각 버튼은 API authorize 엔드포인트로 향하는 링크이며, 클릭 시 브라우저가
 * provider 인증 페이지로 이동한다(서버 리다이렉트 흐름). 성공하면 API 가
 * httpOnly 쿠키를 심고 web 으로 되돌려보낸다.
 */
export const SocialLoginButtons = () => (
  <div className='flex flex-col gap-2'>
    {SOCIAL_PROVIDERS_UI.map((provider) => (
      <Button
        key={provider.slug}
        asChild
        variant='outline'
        className='w-full'
      >
        <a href={socialAuthUrl(provider.slug)}>{provider.label}</a>
      </Button>
    ))}
  </div>
);
