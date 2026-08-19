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
  lg: "max-w-console",
} as const;

interface PageShellProps {
  /** 상단 고정 헤더에 표시할 화면 이름. */
  title: ReactNode;
  /**
   * 제목 바로 아래 한 줄 설명. **헤더 블록 안**에 들어간다.
   *
   * ⚠️ 한 줄로 잘린다(`truncate`). 여기 문단을 넣으면 안 된다 — 화면의 성격을 말하는
   * 한 문장만 둔다. 길게 설명해야 하는 것은 본문 첫 카드에 두는 게 맞다.
   */
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
      {/*
        페이지 헤더 (mini SaaS 패턴).

        v2 는 헤더에 제목만 두고 설명은 본문 첫 줄로 내려보냈다 — "헤더를 얇게 유지"가
        목적이었다. 여기서는 **설명을 제목 바로 아래로 되돌린다.** 이유는 밀도가 아니라
        의미다: 설명이 본문 안에 있으면 그 화면의 첫 콘텐츠 카드와 같은 층으로 읽혀,
        "이 화면이 무엇인가"와 "이 화면의 데이터"가 구분되지 않았다. 헤더 블록 안에
        있으면 제목의 부속으로 읽힌다.

        높이는 `--spacing-topbar`(56px)로 고정한다. 화면마다 제목 길이에 따라 헤더가
        1~2px 씩 달라지면 화면을 옮길 때 본문이 미세하게 튄다.
      */}
      <header className='sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'>
        <div
          className={`mx-auto flex w-full ${widthClass} min-h-topbar items-center gap-2 px-4 py-2 md:px-6`}
        >
          {backHref && (
            <Link
              href={backHref}
              aria-label='뒤로 가기'
              className='-ml-2 flex size-touch shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground'
            >
              <ChevronLeft className='size-5' />
            </Link>
          )}

          <div className='flex min-w-0 flex-1 flex-col justify-center'>
            {/* 제목 눈금은 `text-title`. 예전엔 `text-name` 이었는데 그 유틸리티는
                정의가 없어 통째로 죽어 있었고, 결과적으로 **모든 화면의 제목이 본문
                크기**로 나왔다(굵기만 살아 "굵은 본문"으로 보였다). `text-name` 은
                이제 개체 이름 전용 눈금이다. */}
            <h1 className='min-w-0 truncate text-title'>{title}</h1>
            {description && (
              <p className='min-w-0 truncate text-meta text-muted-foreground'>
                {description}
              </p>
            )}
          </div>

          {action && <div className='shrink-0'>{action}</div>}
        </div>
      </header>

      <main
        className={`mx-auto w-full ${widthClass} flex-1 space-y-5 px-4 py-5 md:px-6`}
      >
        {children}
      </main>

      {quickActions}
      {nav}
    </div>
  );
};
