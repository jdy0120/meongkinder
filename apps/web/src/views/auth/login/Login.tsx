import { PawPrint } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pawlog/ui";

import { SocialLoginButtons } from "@/features/auth/social-login";

/**
 * 로그인 페이지 (view). 레이아웃만 담당하고 상호작용은 features 에 위임한다.
 *
 * job-036: 인증은 카카오 소셜 로그인 단일 경로다. 별도 회원가입 절차가 없고,
 * 최초 로그인 시 계정이 자동으로 만들어진다.
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
        </CardContent>
      </Card>
    </div>
  );
};
