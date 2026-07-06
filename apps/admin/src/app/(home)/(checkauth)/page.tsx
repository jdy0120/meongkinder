import React from "react";
import { cookies } from "next/headers";
import { Users, CreditCard, Calendar, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@template/ui";

const getStats = async () => {
  const { API_BASE_URL, PROJECT_NAME } = process.env;
  const cookieStore = await cookies();
  const cookieString = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const headers = { Cookie: cookieString };

  try {
    const [usersRes, subsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/${PROJECT_NAME}/admin/users?pageSize=1`, {
        headers,
      }),
      fetch(
        `${API_BASE_URL}/api/${PROJECT_NAME}/admin/subscriptions?pageSize=1`,
        { headers },
      ),
    ]);

    const usersData = usersRes.ok ? await usersRes.json() : null;
    const subsData = subsRes.ok ? await subsRes.json() : null;

    return {
      totalUsers: usersData?.data?.meta?.total || 0,
      totalSubscriptions: subsData?.data?.meta?.total || 0,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return {
      totalUsers: 0,
      totalSubscriptions: 0,
    };
  }
};

export default async function Page() {
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
    <div className='space-y-8'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-bold tracking-tight text-white'>
          대시보드
        </h1>
        <p className='text-slate-400 text-sm'>
          현재 서비스의 주요 현황 지표를 한눈에 모니터링합니다.
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {cardData.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card
              key={i}
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
                <div className='text-2xl font-bold text-white'>
                  {card.value}
                </div>
                <p className='text-xs text-slate-500 mt-1'>{card.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Welcome Card */}
      <Card className='border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/40 text-slate-100 backdrop-blur-sm'>
        <CardContent className='py-8 px-6 flex flex-col md:flex-row items-center justify-between gap-6'>
          <div className='space-y-2'>
            <h2 className='text-xl font-bold text-white'>
              어드민 템플릿에 오신 것을 환영합니다!
            </h2>
            <p className='text-sm text-slate-400 max-w-xl'>
              본 대시보드는 모노레포 아키텍처 상의 API와 실시간으로 연동되어
              있습니다. 좌측 메뉴에서 가입된 사용자의 권한을 변경하고 정기 구독
              내역을 즉시 확인할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
