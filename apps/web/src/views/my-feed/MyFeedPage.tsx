"use client";

import { PageShell } from "@/shared/ui";
import { MobileNav } from "@/widgets/mobile-nav";
import { ProfileAvatar } from "@/widgets/profile-avatar";
import { MyFeed } from "@/widgets/my-feed";

/** 보호자 피드 (view) — 우리 아이가 나온 사진만 모아 보여준다. */
export const MyFeedPage = () => (
  <PageShell
    title='피드'
    description='우리 아이가 나온 사진이 올라오는 대로 여기에 쌓여요.'
    width='md'
    action={<ProfileAvatar />}
      nav={<MobileNav />}
  >
    <MyFeed />
  </PageShell>
);
