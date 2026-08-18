import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pawlog/ui";

import { PageShell } from "@/shared/ui";
import { ProfileForm } from "@/features/profile/update-profile";
import { MobileNav } from "@/widgets/mobile-nav";
import { ProfileAvatar } from "@/widgets/profile-avatar";

interface ProfilePageProps {
  user: {
    nickname: string;
    phone: string | null;
    email: string;
    profileImageFileId: string | null;
  };
}

/**
 * 내 정보 페이지 (view). 레이아웃만 담당하고 상호작용은 features 에 위임한다.
 * 값은 SSR(mypage)에서 받아 넘긴다 — 폼 초기값이 깜빡이지 않도록.
 */
export const ProfilePage = ({ user }: ProfilePageProps) => {
  return (
    <PageShell
      title='내 정보'
      description={user.email}
      backHref='/app'
      width='sm'
      action={<ProfileAvatar />}
      nav={<MobileNav />}
    >
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>
            휴대폰 번호를 등록하면 매장 초대와 자동으로 연결됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              nickname: user.nickname,
              phone: user.phone,
              profileImageFileId: user.profileImageFileId,
            }}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
};
