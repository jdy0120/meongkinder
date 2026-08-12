import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * 화면 폭. 성격에 따라 골라 쓴다 —
 * `sm` 단일 폼, `md` 목록/카드, `lg` 표가 들어가는 운영 화면.
 */
const WIDTH_CLASS = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-5xl",
} as const;

interface PageShellProps {
  /** 상단 고정 헤더에 표시할 화면 이름. */
  title: ReactNode;
  /** 제목 아래 본문 첫 줄로 들어가는 설명. 헤더가 아니라 본문에 둬야 헤더가 얇게 유지된다. */
  description?: ReactNode;
  /** 지정하면 헤더 왼쪽에 뒤로가기 화살표가 생긴다. */
  backHref?: string;
  /** 헤더 오른쪽 액션 (예: "새 리포트 작성" 버튼, 등록 다이얼로그 트리거). */
  action?: ReactNode;
  /** 하단 탭 내비게이션 슬롯. 레이어 규칙상 shared 가 widget 을 직접 import 할 수 없어 view 가 넣어준다. */
  nav?: ReactNode;
  /**
   * 하단 고정 퀵액션(`QuickActionBar`). 하단 탭 **위**에 붙는다 — 순서가 반대면
   * 탭이 액션을 덮는다.
   */
  quickActions?: ReactNode;
  width?: keyof typeof WIDTH_CLASS;
  /**
   * `lg`(1024px) 이상에서 `nav` 가 좌측 고정 사이드바로 바뀌는 화면인지 (job-053).
   *
   * 사이드바는 `fixed` 라 흐름에서 빠져 있으므로 본문을 그 폭만큼 밀어주는 건 여기 몫이다.
   * 켜는 조건은 **넣어준 `nav` 가 실제로 사이드바를 그리는가** 하나다 — 지금은 매장
   * 영역(`/tenant/[tenant]/…`)의 `MobileNav` 뿐이다. 개인 화면에서 켜면 본문만 밀리고
   * 그 자리는 빈 채로 남는다.
   */
  desktopSidebar?: boolean;
  /**
   * `lg` 이상에서 본문 최대 폭 제한을 푼다 (job-053).
   *
   * `desktopSidebar` 와 분리한 이유: 목록·표는 넓을수록 한 화면에 더 들어오지만, 단일
   * 폼(사진 올리기·리포트 작성)은 넓어질수록 라벨과 입력이 멀어져 읽기만 나빠진다.
   * 그 화면들은 사이드바만 받고 폭은 그대로 둔다.
   *
   * `lg` 미만에는 영향이 없다 — 모바일·태블릿은 `width` 가 정한 폭 그대로다.
   */
  desktopWide?: boolean;
  children: ReactNode;
}

/**
 * 모든 화면이 공유하는 페이지 뼈대 (shared/ui).
 *
 * 이걸 만들기 전까지 화면마다 껍데기가 제각각이었다 — 개인 화면은 자체 헤더 + 하단 탭을
 * 직접 조립했고, 매장 화면(`/tenant/[tenant]/…`)은 헤더도 하단 탭도 좌우 여백도 아예 없어서
 * 표가 뷰포트 가장자리에 붙고 뒤로 갈 방법이 브라우저 뒤로가기밖에 없었다.
 *
 * 여기서 한 번에 보장하는 것:
 *   - 좌우 여백과 최대 폭이 화면마다 같다
 *   - 제목 크기가 화면마다 같다 (전엔 2xl/3xl 이 섞여 있었다)
 *   - 스크롤해도 지금 어느 화면인지 보이도록 헤더가 상단에 고정된다
 *   - 하단 탭이 항상 화면 맨 아래에 붙는다 (`min-h-screen` + `sticky bottom-0`)
 *
 * job-053: 데스크톱 폼팩터는 `desktopSidebar` / `desktopWide` 두 스위치로만 갈린다.
 * 둘 다 `lg:` 접두사로만 적용되므로 **모바일·태블릿 렌더 결과는 이 두 값과 무관하게
 * 동일하다** — 반응형을 넣다가 기존 화면이 조용히 바뀌는 걸 막기 위한 제약이다.
 */
export const PageShell = ({
  title,
  description,
  backHref,
  action,
  nav,
  quickActions,
  width = "lg",
  desktopSidebar = false,
  desktopWide = false,
  children,
}: PageShellProps) => {
  // 사이드바가 fixed 라 본문·헤더·퀵액션이 모두 그 폭만큼 밀려야 한다. 바깥 컨테이너에
  // 한 번만 걸면 sticky 인 자식들(헤더·퀵액션·하단탭)까지 같은 기준으로 따라온다.
  const offset = desktopSidebar ? "lg:pl-nav" : "";
  const widthClass = `${WIDTH_CLASS[width]} ${desktopWide ? "lg:max-w-none" : ""}`;

  return (
    <div className={`flex min-h-screen flex-col bg-background ${offset}`}>
      <header className='sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'>
        <div
          className={`mx-auto flex w-full ${widthClass} items-center gap-2 px-5 py-2 md:px-6`}
        >
          {backHref && (
            // 뒤로가기도 누르는 것이므로 64px 터치 타겟이다 (design-system.md §2.3).
            <Link
              href={backHref}
              aria-label='뒤로 가기'
              className='-ml-3 flex size-touch shrink-0 items-center justify-center rounded-pill text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
            >
              <ChevronLeft className='size-6' />
            </Link>
          )}

          <h1 className='min-w-0 flex-1 truncate text-name font-semibold tracking-tight'>
            {title}
          </h1>

          {action && <div className='shrink-0'>{action}</div>}
        </div>
      </header>

      <main
        className={`mx-auto w-full ${widthClass} flex-1 space-y-8 px-5 py-6 md:px-6`}
      >
        {description && (
          <p className='max-w-prose-ko break-keep text-label text-muted-foreground'>
            {description}
          </p>
        )}
        {children}
      </main>

      {quickActions}
      {nav}
    </div>
  );
};
