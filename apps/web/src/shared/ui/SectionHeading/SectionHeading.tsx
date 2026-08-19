import type { ReactNode } from "react";

interface SectionHeadingProps {
  children: ReactNode;
  /** 오른쪽 끝 보조 액션 (예: "전체 보기") */
  action?: ReactNode;
}

/**
 * 섹션 제목 (design-system.md §2.2 — `title` 토큰).
 *
 * 화면마다 제목 크기를 손으로 고르면 같은 앱처럼 보이지 않으므로 여기 한 곳에 고정한다.
 * 예전에는 `text-sm text-muted-foreground` 인 작은 라벨이었는데, 그 크기로는 스크롤
 * 중에 섹션 경계가 안 읽혀서 카드가 한 덩어리로 뭉쳐 보였다. 24px/600 로 올린다.
 */
export const SectionHeading = ({ children, action }: SectionHeadingProps) => (
  <div className='flex items-center justify-between gap-3'>
    {/* ⚠️ 화면 제목(`PageShell` 의 h1)과 **같은 눈금이면 안 된다.** 예전엔 둘 다
        `text-title` 이었는데, 그때 h1 쪽은 `text-name`(정의 없는 죽은 클래스)이라
        실제로는 작게 나와서 우연히 위계가 있는 것처럼 보였다. h1 을 제 눈금으로
        되돌린 지금 둘을 같게 두면 섹션 제목이 화면 제목만큼 커진다. */}
    <h2 className='min-w-0 truncate text-card'>{children}</h2>
    {action && <div className='shrink-0'>{action}</div>}
  </div>
);
