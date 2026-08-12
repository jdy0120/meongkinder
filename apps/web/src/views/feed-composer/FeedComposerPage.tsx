"use client";

import { useParams } from "next/navigation";

import { PageShell } from "@/shared/ui";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { FeedComposer } from "@/features/feed/create-post";
import { MobileNav } from "@/widgets/mobile-nav";

/** 사진 올리기 (view) — 업로드 플로우 전체는 feature 가 갖고, 여기선 껍데기만 씌운다. */
export const FeedComposerPage = () => {
  const { tenant } = useParams<{ tenant: string }>();
  const feedHref = tenantPath(tenant, "feed");

  return (
    <PageShell
      title='사진 올리기'
      width='md'
      backHref={feedHref}
      // 모바일에서는 지금까지처럼 하단 탭 없이 뒤로가기만 (집중 플로우).
      // 데스크톱은 좌측이 비어 있으므로 사이드바만 붙인다. 폼이라 폭은 넓히지 않는다.
      nav={<MobileNav withBottomBar={false} />}
      desktopSidebar
    >
      <FeedComposer doneHref={feedHref} />
    </PageShell>
  );
};
