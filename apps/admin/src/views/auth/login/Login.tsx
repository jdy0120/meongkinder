import { AlertTriangle } from "lucide-react";

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
 *
 * ⚠️ 예전에는 `bg-muted` + 기본 `Card` 였다. admin 은 라이트 토큰 위에 화면마다 어두운
 * 색을 덧칠하는 구조였고 이 화면만 덧칠이 없어서, **콘솔 전체에서 여기만 밝게** 나왔다.
 * 이제 테마가 기본값을 정하므로 토큰 이름만 쓴다.
 */
export const LoginPage = ({ error }: LoginPageProps) => {
  const notice = error ? REDIRECT_NOTICE[error] : undefined;

  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <div className='flex w-full max-w-sm flex-col gap-6 rounded-3xl p-8 neu-raised'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <div className='flex size-12 items-center justify-center rounded-2xl bg-primary text-title font-extrabold text-primary-foreground shadow-[var(--neu-sm)]'>
            P
          </div>
          <div className='flex flex-col gap-1'>
            <h1 className='text-card text-foreground'>플랫폼 운영자 로그인</h1>
            <p className='text-body-sm text-text-muted'>
              pawlog 플랫폼 관리 콘솔입니다.
            </p>
          </div>
        </div>

        {notice && (
          <p className='flex items-start gap-2 rounded-xl bg-danger-tint px-4 py-3 text-body-sm text-danger-strong'>
            <AlertTriangle className='mt-0.5 size-4 shrink-0' />
            {notice}
          </p>
        )}

        <LoginForm />
      </div>
    </div>
  );
};
