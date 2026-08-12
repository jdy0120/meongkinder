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
    <aside className='w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen text-slate-200'>
      <div className='flex flex-col'>
        <div className='p-6 border-b border-slate-800 flex items-center gap-3'>
          <div className='w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30'>
            P
          </div>
          <span className='font-semibold text-lg tracking-wide text-white'>
            Pawlog Platform
          </span>
        </div>

        <nav className='p-4 space-y-1'>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400"}`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className='p-4 border-t border-slate-800 bg-slate-950/40'>
        <div className='flex items-center gap-3 px-2 py-3'>
          <div className='w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-100'>
            {user.nickname[0]?.toUpperCase() || "U"}
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-semibold text-white truncate'>
              {user.nickname}
            </p>
            <p className='text-xs text-slate-500 truncate'>{user.email}</p>
          </div>
        </div>

        <div className='px-2 pb-1'>
          <RoleBadge role={user.role} />
        </div>

        <button
          onClick={onLogout}
          className='w-full flex items-center justify-center gap-2 mt-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 cursor-pointer'
        >
          <LogOut className='w-4 h-4' />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
