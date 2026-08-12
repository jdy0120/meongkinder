import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pawlog/ui";

import { LoginForm } from "@/features/auth/login";

interface LoginPageProps {
  /** `(checkauth)` 레이아웃이 접근을 거부하며 붙여 보내는 사유. */
  error?: string;
}

/** 레이아웃 게이트가 튕겨낸 사유별 안내 문구. */
const REDIRECT_NOTICE: Record<string, string> = {
  forbidden:
    "플랫폼 운영자(SUPER_ADMIN) 계정만 이용할 수 있습니다. 매장 운영은 pawlog 서비스에서 진행해 주세요.",
  inactive: "이용이 정지되었거나 승인 대기 중인 계정입니다.",
};

/**
 * 관리자 로그인 페이지 (view). 레이아웃만 담당하고 상호작용은 features 에 위임한다.
 *
 * job-036: 보호자용 web 은 카카오 소셜 로그인만 쓰지만, 관리자 앱은 이메일/비밀번호
 * 로그인을 유지한다.
 *
 * job-038: 매장 개설·운영 화면은 apps/web 으로 옮겨졌다. 이 콘솔은 플랫폼 운영자 전용이다.
 */
export const LoginPage = ({ error }: LoginPageProps) => {
  const notice = error ? REDIRECT_NOTICE[error] : undefined;

  return (
    <div className='flex min-h-screen items-center justify-center bg-muted p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>플랫폼 운영자 로그인</CardTitle>
          <CardDescription>
            pawlog 플랫폼 관리 콘솔입니다. 운영자 계정으로 로그인하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          {notice && (
            <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {notice}
            </p>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
};
