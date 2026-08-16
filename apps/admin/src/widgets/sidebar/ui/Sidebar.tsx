"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  LogOut,
  ShieldCheck,
  Settings,
  Building2,
} from "lucide-react";
import { type Role } from "@pawlog/shared";
import { RoleBadge } from "@/entities/user";

interface SidebarProps {
  user: {
    nickname: string;
    email: string;
    role: Role;
  };
  onLogout: () => void;
}

/**
 * 플랫폼 관리 콘솔 사이드바 (job-038).
 *
 * apps/admin 은 **pawlog 운영사(SUPER_ADMIN) 전용** 콘솔이다. 매장 운영(출석부·리포트·
 * 구성원·원생)은 전부 apps/web 의 `/[tenant]/…` 로 이관됐다. 여기 메뉴는 전 플랫폼을
 * 대상으로 하는 것만 남는다 — 그래서 역할별 분기가 필요 없다(진입 자체가 SUPER_ADMIN 전용).
 *
 * 뉴모피즘 적용 노트: 사이드바는 본문과 **같은 톤**이고 오른쪽 그림자로만 갈린다.
 * 선택된 메뉴는 색을 채우지 않고 **눌린 면 + 강조색 글자**로 표시한다 — 채우면 화면에
 * 채운 색이 둘(선택 메뉴 + 주 행동 버튼) 생겨 어느 쪽이 행동인지 흐려진다.
 */
const menuItems: {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
}[] = [
  { name: "대시보드", href: "/", icon: LayoutDashboard },
  { name: "테넌트 관리", href: "/tenants", icon: Building2 },
  { name: "회원 관리", href: "/users", icon: Users },
  { name: "구독 현황", href: "/subscriptions", icon: CreditCard },
  { name: "약관 관리", href: "/terms", icon: ShieldCheck },
  { name: "시스템 설정", href: "/system", icon: Settings },
];

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className='z-10 flex h-screen w-64 shrink-0 flex-col justify-between bg-background text-foreground shadow-[8px_0_24px_rgb(13_16_22/0.45)]'>
      <div className='flex flex-col'>
        <div className='flex items-center gap-3 px-5 py-6'>
          {/* 로고 마크는 유일하게 채운 강조색을 쓰는 비-행동 요소다 — 아이덴티티라
              뉴모피즘으로 눌러 두면 브랜드가 사라진다. */}
          <div className='flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground shadow-[var(--neu-sm)]'>
            P
          </div>
          <div className='flex flex-col'>
            <span className='text-card font-bold tracking-tight text-foreground'>
              Pawlog
            </span>
            <span className='text-meta text-text-meta'>Platform Console</span>
          </div>
        </div>

        <nav className='flex flex-col gap-1.5 px-3 py-2'>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-body-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "neu-press-on"
                    : "text-text-muted hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className='size-5 shrink-0' />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className='m-3 rounded-2xl p-3 neu-inset'>
        <div className='flex items-center gap-3 px-1 py-2'>
          <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-body-sm font-bold text-primary-on-tint'>
            {user.nickname[0]?.toUpperCase() || "U"}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-body-sm font-semibold text-foreground'>
              {user.nickname}
            </p>
            <p className='truncate text-meta text-text-meta'>{user.email}</p>
          </div>
        </div>

        <div className='px-1 pb-2'>
          <RoleBadge role={user.role} />
        </div>

        <button
          onClick={onLogout}
          className='mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-body-sm font-semibold text-danger-strong transition-colors duration-150 hover:bg-danger-tint'
        >
          <LogOut className='size-4' />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
