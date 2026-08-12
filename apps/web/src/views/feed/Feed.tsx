"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@pawlog/ui";

import { PageShell } from "@/shared/ui";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { RunDigestButton } from "@/features/feed/run-digest";
import { FeedBoard } from "@/widgets/feed-board";
import { MobileNav } from "@/widgets/mobile-nav";
import { PhotoGapAlert } from "@/widgets/photo-gap-alert";

/**
 * 매장 피드 (view) — 오늘 올라온 사진 + 누락 알림 + 하루 마감.
 * 화면 조립만 담당하고 데이터는 각 위젯이 스스로 가져온다.
 */
export const FeedPage = () => {
  const { tenant } = useParams<{ tenant: string }>();

  return (
    <PageShell
      title='피드'
      description='노는 중에 찍어 올리면 태그된 아이의 보호자에게 바로 전달됩니다.'
      width='md'
      nav={<MobileNav />}
      desktopSidebar
      desktopWide
      action={
        <Button asChild className='gap-1.5'>
          <Link href={tenantPath(tenant, "feed", "new")} aria-label='사진 올리기'>
            <Camera className='size-4' />
            <span className='hidden sm:inline'>사진 올리기</span>
          </Link>
        </Button>
      }
    >
      <PhotoGapAlert />

      <div className='flex justify-end'>
        <RunDigestButton />
      </div>

      <FeedBoard />
    </PageShell>
  );
};
