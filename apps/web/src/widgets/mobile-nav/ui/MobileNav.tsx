"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Home,
  Images,
  LogOut,
  Newspaper,
  PawPrint,
  Store,
  Ticket,
} from "lucide-react";

import { tenantPath } from "@/shared/libs/tenant/routes";
import {
  TENANT_MENU_GROUP_LABEL,
  visibleTenantMenu,
  type TenantMenuGroup,
} from "@/shared/libs/tenant/menu";
import { useTenantStore } from "@/shared/libs/zustand/stores/tenant.store";

/**
 * 개인 스코프 탭 — 보호자로서의 나. 매장과 무관하다.
 * 피드가 홈 바로 옆에 오는 건 매일 열어보는 화면이 그것이기 때문이다 — 리포트는 하루 한 번
 * 마감된 결과이고, 피드는 낮 동안 실시간으로 쌓인다.
 */
const PERSONAL_TABS = [
  // job-048: 6개 → 5개. 엄지 도달 범위를 넘으면 끝의 탭은 실제로 안 눌린다
  // (design-system.md §8). "내 매장"은 자주 가지 않는 화면이라 홈 바로가기로 내렸다.
  { href: "/app", label: "홈", icon: Home },
  { href: "/feed", label: "사진", icon: Images },
  { href: "/reports", label: "알림장", icon: Newspaper },
  { href: "/subscriptions", label: "정기권", icon: Ticket },
  { href: "/pet", label: "아이", icon: PawPrint },
];

/**
 * 매장 스코프 메뉴는 `shared/libs/tenant/menu` 가 단일 출처다 — 매장 홈 카드와 여기가
 * 같은 배열을 읽는다. 전에는 각자 들고 있어서 사이드바에만 다섯 개가 빠져 있었다.
 *
 * 하단 탭에는 `bottomTab` 이 켜진 것만 올라가고(엄지 도달 범위, 최대 5개),
 * **사이드바에는 역할로 열리는 전부**가 올라간다 — 데스크톱은 세로로 자리가 남고,
 * 마우스에는 도달 범위 제약이 없다.
 */

/** 매장 영역에서 개인 영역으로 돌아가는 출구. 없으면 갇힌 느낌이 든다. */
const EXIT_TAB = { href: "/app", label: "나가기", icon: LogOut };

interface MobileNavProps {
  /**
   * 하단 탭 바를 그릴지. 기본 `true`.
   *
   * `false` 는 **모바일에서 원래 하단 탭이 없던 집중 플로우**(사진 올리기, 리포트 작성/수정)
   * 전용이다. 그 화면들은 뒤로가기 화살표 하나로 빠져나가도록 의도적으로 탭을 뺐는데,
   * 데스크톱은 좌측에 자리가 남으므로 사이드바만 붙인다. 모바일 화면은 그대로다.
   */
  withBottomBar?: boolean;
}

/**
 * 내비게이션 (widget) — job-038 / 반응형 job-053.
 *
 * 하나의 내비게이션이 **어디에 있는지 + 그 매장에서 내 역할이 무엇인지**로 갈라진다.
 *   - 개인 영역(`/app`, `/pet` …)  → 보호자 탭
 *   - 매장 영역(`/tenant/[tenant]/…`) → 그 매장에서의 역할에 맞는 운영 탭
 *
 * 같은 계정이 A매장에서는 관리자, B매장에서는 보호자일 수 있으므로 탭 구성도 매장을
 * 옮기면 바뀐다. 역할은 `(tenantAuth)/tenant/[tenant]/layout` 이 심어준 store 값을 쓴다.
 *
 * ## 폼팩터 (job-053)
 *
 * **매장 영역에 한해** `lg`(1024px) 이상에서 하단 탭이 좌측 사이드바로 바뀐다. 매장 운영
 * 화면은 원장이 데스크톱에서도 여는데, 하단 고정 탭은 화면 아래 60px 을 계속 먹으면서
 * 마우스 이동 거리는 가장 먼 자리에 있다 — 모바일에서 최선인 배치가 데스크톱에서는
 * 정확히 최악이다.
 *
 * 임계값이 `md`(768px)가 아니라 `lg` 인 이유: 태블릿은 이 제품의 **주 사용 기기**이고
 * (design-system.md §0) 손가락으로 조작한다. 768px 에서 사이드바로 바꾸면 태블릿이
 * 마우스용 배치를 쓰게 된다.
 *
 * 개인 영역(`/app`, `/pet` …)은 폭과 무관하게 하단 탭 그대로다 — 그쪽은 별도 작업이다.
 * 그래서 `lg:hidden` 은 사이드바가 실제로 뜨는 매장 영역에서만 붙인다. 무조건 붙이면
 * 데스크톱의 개인 화면에 내비게이션이 하나도 남지 않는다.
 */
export const MobileNav = ({ withBottomBar = true }: MobileNavProps) => {
  const pathname = usePathname();
  const params = useParams<{ tenant?: string }>();
  const currentRole = useTenantStore((state) => state.currentRole);
  const isPlatformAdmin = useTenantStore((state) => state.isPlatformAdmin);
  const tenantId = useTenantStore((state) => state.tenantId);
  const currentTenantName = useTenantStore((state) => state.currentTenantName);

  const tenant = params?.tenant;
  // 사이드바는 매장 영역에만 있다. 하단 탭을 `lg` 에서 숨길지도 이 값이 정한다.
  const hasSidebar = Boolean(tenant);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  // 매장 영역에서 역할은 `TenantRouteSync` 가 hydration 후에 심어준다. 그때까지 탭을
  // 그리면 "나가기" 하나만 있다가 갑자기 여러 개로 늘어나 바가 튄다 — 같은 크기의
  // 빈 껍데기를 먼저 깔아 자리만 잡아둔다. 사이드바 쪽은 폭을 잡아야 본문이 밀리지 않는다.
  //
  // job-050: 판단 기준을 `currentRole` 이 아니라 `tenantId` 로 둔다. SUPER_ADMIN 이
  // 소속 없이 열람 중이면 role 은 끝까지 null 이라, role 로 보면 빈 바가 영원히 남는다.
  // `tenantId` 는 두 경우 모두 enterTenant 가 채우므로 "hydration 됐는가"의 정확한 신호다.
  if (tenant && !tenantId) {
    return (
      <>
        {withBottomBar && (
          <nav className='sticky bottom-0 z-10 h-touch border-t border-border bg-background lg:hidden' />
        )}
        <aside className='fixed inset-y-0 left-0 z-30 hidden w-nav border-r border-sidebar-border bg-sidebar lg:block' />
      </>
    );
  }

  const tenantMenu = tenant
    ? visibleTenantMenu(currentRole, isPlatformAdmin).map((item) => ({
        ...item,
        href: tenantPath(tenant, item.path),
      }))
    : [];

  // 사이드바는 그룹째로 그린다. 항목이 하나도 없는 그룹은 제목만 남지 않도록 통째로 뺀다
  // (STAFF 는 management 가 전부 비어 "매장 관리" 제목만 떠 있게 된다).
  const sidebarGroups = (
    ["operations", "management"] as TenantMenuGroup[]
  ).flatMap((group) => {
    const items = tenantMenu.filter((item) => item.group === group);
    return items.length ? [{ group, items }] : [];
  });

  // 하단 탭은 엄지 도달 범위 안에 들어와야 하므로 전체가 아니라 `bottomTab` 만 올린다.
  const tabs = tenant
    ? [
        ...tenantMenu
          .filter((item) => item.bottomTab)
          .map(({ href, short, icon }) => ({ href, label: short, icon })),
        EXIT_TAB,
      ]
    : PERSONAL_TABS;

  return (
    <>
      {withBottomBar && (
        <nav
          className={`sticky bottom-0 z-10 flex border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${
            hasSidebar ? "lg:hidden" : ""
          }`}
        >
          {tabs.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex min-h-touch flex-1 flex-col items-center justify-center gap-1 py-1.5 text-meta transition-colors duration-150 ${
                isActive(href)
                  ? "font-semibold text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className='size-5' />
              {label}
            </Link>
          ))}
        </nav>
      )}

      {hasSidebar && (
        <aside className='fixed inset-y-0 left-0 z-30 hidden w-nav flex-col border-r border-sidebar-border bg-sidebar lg:flex'>
          {/* 어느 매장을 보고 있는지 — 겸업이면 두 탭에 서로 다른 매장이 열려 있을 수 있다. */}
          {/* 사이드바 머리 높이를 본문 헤더(`--spacing-topbar`)와 **같은 토큰**으로 맞춘다.
              달라지면 사이드바 경계선과 헤더 경계선이 몇 px 어긋나 화면이 삐뚤어 보인다. */}
          <div className='flex min-h-topbar shrink-0 items-center gap-2 border-b border-sidebar-border px-3'>
            <Store className='size-5 shrink-0 text-brand' />
            <span className='truncate text-name text-sidebar-foreground'>
              {currentTenantName ?? tenant}
            </span>
          </div>

          <nav className='flex flex-1 flex-col gap-4 overflow-y-auto p-3'>
            {sidebarGroups.map(({ group, items }) => (
              <div key={group} className='flex flex-col gap-1'>
                <span className='px-2.5 pb-1 text-label tracking-wide text-muted-foreground'>
                  {TENANT_MENU_GROUP_LABEL[group]}
                </span>
                {items.map(({ href, short, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={`flex min-h-control items-center gap-2.5 rounded-btn px-2.5 text-body-sm transition-colors duration-150 ${
                      isActive(href)
                        ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <Icon className='size-5 shrink-0' />
                    <span className='truncate'>{short}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          {/* 출구는 맨 아래. 운영 메뉴와 섞이면 실수로 눌러 매장을 벗어난다. */}
          <div className='shrink-0 border-t border-sidebar-border p-3'>
            <Link
              href={EXIT_TAB.href}
              className='flex min-h-touch items-center gap-3 rounded-btn px-3 text-label text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            >
              <EXIT_TAB.icon className='size-5 shrink-0' />
              <span className='truncate'>{EXIT_TAB.label}</span>
            </Link>
          </div>
        </aside>
      )}
    </>
  );
};
