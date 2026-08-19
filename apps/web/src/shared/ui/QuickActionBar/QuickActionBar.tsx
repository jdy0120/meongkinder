import type { ReactNode } from "react";

interface QuickActionBarProps {
  /**
   * 최대 3개. 그 이상이면 위계가 없다는 뜻이므로 화면 안 섹션으로 내린다
   * (design-system.md §6.2).
   */
  children: ReactNode;
}

/**
 * 화면 하단 고정 퀵액션 (design-system.md §2.3 · §6.2).
 *
 * 버튼 높이 44px(`--spacing-touch`)를 엄지 도달 범위에 고정으로 둔다. 대시보드에서 "지금 뭘 해야 하나"를
 * 읽은 직후 바로 실행할 수 있어야 하는데, 실행 버튼이 스크롤 안에 있으면 정보를 읽고
 * 다시 찾아 내려가야 한다.
 *
 * 하단 탭(`MobileNav`) 바로 위에 붙으므로 두 개를 같이 쓰면 하단이 약 100px 을 먹는다.
 * 퀵액션이 있는 화면은 그만큼 본문 아래 여백을 확보한다(`PageShell` 이 처리).
 */
export const QuickActionBar = ({ children }: QuickActionBarProps) => (
  <div className='sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'>
    <div className='mx-auto grid w-full max-w-2xl auto-cols-fr grid-flow-col gap-2 px-4 py-2.5'>
      {children}
    </div>
  </div>
);
