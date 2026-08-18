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
      // 본문 폭은 데스크톱에서도 672px(`md`)에서 멈춘다.
      //
      // `desktopWide` 를 걸면 lg 이상에서 제한이 풀리는데(`lg:max-w-none`), 피드는
      // 목록·표가 아니라 **사진 한 장씩 내려가는 단일 컬럼**(`FeedBoard` 는 space-y 스택)
      // 이라 폭이 넓어져도 한 화면에 더 들어오는 게 없다. 카드와 사진만 가로로 늘어나
      // 읽기가 나빠지고, 사진 올리기 화면(`/feed/new`, 672px)과 폭이 달라 오가는 동안
      // 레이아웃이 튄다. 사이드바 오프셋은 그대로 필요하므로 `desktopSidebar` 는 남긴다.
      width='md'
      nav={<MobileNav />}
      desktopSidebar
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
