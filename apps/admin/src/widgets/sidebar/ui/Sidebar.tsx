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
} from "lucide-react";

interface SidebarProps {
  user: {
    nickname: string;
    email: string;
  };
  onLogout: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    {
      name: "대시보드",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "사용자 관리",
      href: "/users",
      icon: Users,
    },
    {
      name: "구독 관리",
      href: "/subscriptions",
      icon: CreditCard,
    },
    {
      name: "약관 관리",
      href: "/terms",
      icon: ShieldCheck,
    },
    {
      name: "시스템 설정",
      href: "/system",
      icon: Settings,
    },
  ];

  return (
    <aside className='w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen text-slate-200'>
      <div className='flex flex-col'>
        {/* Logo/Header */}
        <div className='p-6 border-b border-slate-800 flex items-center gap-3'>
          <div className='w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30'>
            A
          </div>
          <span className='font-semibold text-lg tracking-wide text-white'>
            Template Admin
          </span>
        </div>

        {/* Navigation Menus */}
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

      {/* User profile & Logout */}
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
