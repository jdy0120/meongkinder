import React from "react";
import { cookies } from "next/headers";
import { Users, CreditCard, Calendar, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@pawlog/ui";

/** 관리자 대시보드 통계 조회 (SSR — 쿠키를 직접 주입해 API 호출) */
const getStats = async () => {
  const apiUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3000";
  const proj =
    process.env.PROJECT_NAME ||
    process.env.NEXT_PUBLIC_PROJECT_NAME ||
    "outsourcing";
  const cookieStore = await cookies();
  const cookieString = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const headers = { Cookie: cookieString };

  try {
    const [usersRes, subsRes] = await Promise.all([
      fetch(`${apiUrl}/api/${proj}/v1/admin/users?pageSize=1`, {
        headers,
      }),
      fetch(`${apiUrl}/api/${proj}/v1/admin/subscriptions?pageSize=1`, {
        headers,
      }),
    ]);

    const usersData = usersRes.ok ? await usersRes.json() : null;
    const subsData = subsRes.ok ? await subsRes.json() : null;

    return {
      totalUsers: usersData?.data?.meta?.total || 0,
      totalSubscriptions: subsData?.data?.meta?.total || 0,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return { totalUsers: 0, totalSubscriptions: 0 };
  }
};

/** 대시보드 지표 카드 그리드 (widget). 통계는 서버에서 조회한다. */
export const DashboardStats = async () => {
  const stats = await getStats();

  const cardData = [
    {
      title: "전체 가입자",
      value: `${stats.totalUsers.toLocaleString()}명`,
      icon: Users,
      desc: "서비스에 등록된 총 계정 수",
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "활성 구독 건수",
      value: `${stats.totalSubscriptions.toLocaleString()}건`,
      icon: CreditCard,
      desc: "정기 결제 이용 중인 사용자 수",
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "월 예상 매출",
      value: `${(stats.totalSubscriptions * 29900).toLocaleString()}원`, // PREMIUM 요금제 기준 단순 계산
      icon: Calendar,
      desc: "현재 구독 기준 예상 월 매출",
      color: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "시스템 상태",
      value: "정상 운영중",
      icon: ShieldCheck,
      desc: "데이터베이스 및 결제 모듈 정상",
      color: "text-purple-500 bg-purple-500/10",
    },
  ];

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      {cardData.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className='border-slate-800 bg-slate-900/50 text-slate-100 backdrop-blur-sm'
          >
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-slate-400'>
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <Icon className='w-4 h-4' />
              </div>
            </CardHeader>
            <CardContent className='pt-2'>
              <div className='text-2xl font-bold text-white'>{card.value}</div>
              <p className='text-xs text-slate-500 mt-1'>{card.desc}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
