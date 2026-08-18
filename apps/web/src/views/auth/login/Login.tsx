import { PawPrint, Wrench } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pawlog/ui";

import { LoginForm } from "@/features/auth/login";
import { SocialLoginButtons } from "@/features/auth/social-login";
import { IS_DEV_LOGIN_ENABLED } from "@/shared/constants/dev-login";

/**
 * 로그인 페이지 (view). 레이아웃만 담당하고 상호작용은 features 에 위임한다.
 *
 * job-036: 실제 인증 경로는 카카오 소셜 로그인 하나다. 별도 회원가입 절차가 없고,
 * 최초 로그인 시 계정이 자동으로 만들어진다.
 *
 * 그 아래의 이메일 + 비밀번호 폼은 **개발 환경에서만** 그려진다
 * (`IS_DEV_LOGIN_ENABLED` 참고). 카카오는 키·리다이렉트 URI·실제 카카오 계정이
 * 모두 필요한 외부 의존이라, 그것 없이는 로컬에서 시드 계정으로 화면을 열어보는
 * 것조차 안 되기 때문이다. 순서를 카카오 아래에 두는 것은 의도적이다 — 개발
 * 환경에서도 기본 경로가 무엇인지가 화면에 그대로 보여야 한다.
 */
export const LoginPage = () => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <Card className='w-full max-w-sm border-border/50 shadow-xl shadow-primary/5 transition-all'>
        <CardHeader className='flex flex-col items-center text-center pb-2'>
          <div className='mb-4 flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary'>
            <PawPrint className='size-8' />
          </div>
          <CardTitle className='text-2xl font-bold'>Pawlog Kids</CardTitle>
          <CardDescription className='text-base mt-2'>
            카카오 계정으로 간편하게 시작하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className='pt-6'>
          <SocialLoginButtons />

          {IS_DEV_LOGIN_ENABLED && (
            <section className='mt-6 flex flex-col gap-4 rounded-xl border border-dashed border-caution bg-caution-tint p-4'>
              <header className='flex items-center gap-2 text-caution-text'>
                <Wrench className='size-4 shrink-0' />
                <span className='font-semibold'>개발 전용 로그인</span>
              </header>
              <p className='text-muted-foreground'>
                이 영역은 개발 환경에서만 보입니다. 운영 로그인은 위의 카카오
                버튼입니다.
              </p>

              <LoginForm />
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
