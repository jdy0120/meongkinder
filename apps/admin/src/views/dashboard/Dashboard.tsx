import { Building2, Users, ScrollText } from "lucide-react";
import Link from "next/link";

import { DashboardStats } from "@/widgets/dashboard-stats";
import { PageHeader } from "@/shared/ui";

/** 지표 아래에 두는 바로가기 — 콘솔에서 실제로 매일 여는 세 곳. */
const SHORTCUTS = [
  {
    href: "/tenants",
    icon: Building2,
    title: "테넌트 관리",
    desc: "매장 정보 수정 · 운영 정지/재개",
  },
  {
    href: "/users",
    icon: Users,
    title: "회원 관리",
    desc: "계정 정지 · 삭제 · 운영자 승격",
  },
  {
    href: "/terms",
    icon: ScrollText,
    title: "약관 관리",
    desc: "새 버전 등록 · 활성화",
  },
];

/**
 * 대시보드 페이지 (view). 헤더 + 통계 위젯 + 바로가기 조합만 담당한다.
 *
 * 예전 자리에 있던 "어드민 템플릿에 오신 것을 환영합니다" 카드는 **템플릿 잔재**라
 * 걷어냈다. 운영자가 매일 여는 화면에서 가장 큰 면적을 읽을 필요 없는 문구가 차지하고
 * 있었다 — 그 자리에 실제로 이동할 곳을 둔다.
 */
export const DashboardPage = () => {
  return (
    <div className='flex flex-col gap-7'>
      <PageHeader
        title='대시보드'
        description='현재 서비스의 주요 현황 지표를 한눈에 모니터링합니다.'
      />

      <DashboardStats />

      <div className='grid gap-4 md:grid-cols-3'>
        {SHORTCUTS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className='flex items-center gap-4 rounded-2xl p-5 neu-press'
            >
              <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary-on-tint'>
                <Icon className='size-5' />
              </div>
              <div className='flex flex-col gap-0.5'>
                <span className='text-body-sm font-semibold text-foreground'>
                  {item.title}
                </span>
                <span className='text-meta text-text-meta'>{item.desc}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
