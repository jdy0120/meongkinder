import type { PendingRequiredTerms } from "@pawlog/shared";

import { PageShell } from "@/shared/ui";
import { CompleteProfileForm } from "@/features/auth/complete-profile";

interface WelcomePageProps {
  terms: PendingRequiredTerms[];
  hasPhone: boolean;
}

/**
 * 최초 진입 게이트 화면 (view) — 필수 약관 동의 + (선택) 전화번호.
 *
 * 카카오 로그인은 약관 동의를 거치지 않아 계정이 미동의 상태로 만들어진다. 이 화면을
 * 지나기 전에는 `(checkauth)` 아래 어떤 페이지도 열리지 않는다.
 *
 * 하단 네비게이션(MobileNav)을 두지 않는다 — 여기서 빠져나갈 길을 주면 게이트가 아니다.
 */
export const WelcomePage = ({ terms, hasPhone }: WelcomePageProps) => (
  <PageShell
    title='시작하기'
    description='서비스 이용을 위해 아래 항목을 확인해주세요.'
    width='sm'
  >
    <CompleteProfileForm terms={terms} hasPhone={hasPhone} />
  </PageShell>
);
