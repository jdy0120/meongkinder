import React from "react";
import { cookies } from "next/headers";
import { Users, CreditCard, Calendar, ShieldCheck, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@pawlog/ui";

interface SeatSubscription {
  plan: { price: number } | null;
}

/** `GET v1/health` 응답 본문 (health.controller). */
interface HealthStatus {
  status: string;
  db: string;
  redis: string;
}

/**
 * 플랫폼 대시보드 통계 조회 (SSR — 쿠키를 직접 주입해 API 호출).
 *
 * job-038: 반드시 `v1/platform/*` 를 쓴다. `v1/admin/*` 는 테넌트 스코프 엔드포인트라
 * `requireTenantId()` 가 필요한데, SSR fetch 에는 `X-Tenant-Id` 헤더를 붙이는 클라이언트
 * axios 인터셉터가 관여하지 않는다 — 그래서 `v1/admin/users` 는 여기서 항상 500 이 났고,
 * `usersRes.ok === false` 로 삼켜져 "전체 가입자 0명"으로 보였다.
 * (그리고 애초에 매장 하나가 아니라 플랫폼 전체 수치를 보여줘야 하는 화면이다.)
 */
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
  const api = (path: string) => `${apiUrl}/api/${proj}/${path}`;

  try {
    const [usersRes, seatsRes, tenantsRes, healthRes] = await Promise.all([
      fetch(api("v1/platform/users?pageSize=1"), { headers }),
      // 매출 추정을 위해 요금이 필요하므로 목록도 함께 받는다(허용 최대 100건).
      fetch(api("v1/platform/subscriptions?status=ACTIVE&pageSize=100"), {
        headers,
      }),
      fetch(api("v1/tenants?pageSize=1"), { headers }),
      fetch(api("v1/health"), { headers, cache: "no-store" }),
    ]);

    const usersData = usersRes.ok ? await usersRes.json() : null;
    const seatsData = seatsRes.ok ? await seatsRes.json() : null;
    const tenantsData = tenantsRes.ok ? await tenantsRes.json() : null;
    const healthData = healthRes.ok ? await healthRes.json() : null;

    const seatItems: SeatSubscription[] = seatsData?.data?.items ?? [];
    const activeSeats: number = seatsData?.data?.meta?.total ?? 0;

    // 받아온 페이지의 실제 요금을 합산한다. 100건을 넘으면 평균가로 남은 건수를 환산한다
    // (카드 문구가 "예상"인 이유). 플랜별 가격이 달라도 하드코딩보다 정확하다.
    const sampledRevenue = seatItems.reduce(
      (sum, item) => sum + (item.plan?.price ?? 0),
      0,
    );
    const monthlyRevenue =
      seatItems.length > 0
        ? Math.round((sampledRevenue / seatItems.length) * activeSeats)
        : 0;

    return {
      totalUsers: usersData?.data?.meta?.total ?? 0,
      activeSeats,
      monthlyRevenue,
      totalTenants: tenantsData?.data?.meta?.total ?? 0,
      health: (healthData?.data as HealthStatus | undefined) ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return {
      totalUsers: 0,
      activeSeats: 0,
      monthlyRevenue: 0,
      totalTenants: 0,
      health: null as HealthStatus | null,
    };
  }
};

/** 대시보드 지표 카드 그리드 (widget). 통계는 서버에서 조회한다. */
export const DashboardStats = async () => {
  const stats = await getStats();

  const health = stats.health;
  const isHealthy = health?.status === "ok";

  const cardData = [
    {
      title: "전체 가입자",
      value: `${stats.totalUsers.toLocaleString()}명`,
      icon: Users,
      desc: "플랫폼에 등록된 총 계정 수",
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "운영 중인 매장",
      value: `${stats.totalTenants.toLocaleString()}곳`,
      icon: Store,
      desc: "개설된 테넌트(매장) 수",
      color: "text-sky-500 bg-sky-500/10",
    },
    {
      title: "활성 매장 개설권",
      value: `${stats.activeSeats.toLocaleString()}건`,
      icon: CreditCard,
      desc: "결제 중인 매장 개설권(SaaS 좌석) 수",
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "월 예상 매출",
      value: `${stats.monthlyRevenue.toLocaleString()}원`,
      icon: Calendar,
      desc: "활성 개설권 요금 합계 기준",
      color: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "시스템 상태",
      value: !health ? "확인 불가" : isHealthy ? "정상 운영중" : "점검 필요",
      icon: ShieldCheck,
      desc: !health
        ? "헬스체크 응답 없음"
        : `DB ${health.db} · Redis ${health.redis}`,
      color: !health
        ? "text-slate-500 bg-slate-500/10"
        : isHealthy
          ? "text-purple-500 bg-purple-500/10"
          : "text-red-500 bg-red-500/10",
    },
  ];

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
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
