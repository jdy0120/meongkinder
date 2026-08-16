import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ROLES } from "@pawlog/shared";
import { Sidebar } from "@/widgets/sidebar";
import { TenantSync } from "@/shared/libs/tenant/TenantSync";

interface LayoutProps {
  children: React.ReactNode;
}

/**
 *
 * SSR 즉 백엔드 에선 쿠키를 저장하지 않는다
 * 때문에 cookie를 직접 넣어주는 작업 필요
 *
 */

const getMe = async () => {
  const apiUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3000";
  const proj =
    process.env.PROJECT_NAME || process.env.NEXT_PUBLIC_PROJECT_NAME || "myapp";
  const cookieStore = await cookies();

  const cookieString = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await fetch(`${apiUrl}/api/${proj}/v1/auth/mypage`, {
    method: "GET",
    headers: {
      Cookie: cookieString,
    },
  });

  return response;
};

const layout = async ({ children }: LayoutProps) => {
  const response = await getMe();

  if (!response.ok) {
    redirect("/auth/login");
  }

  const data = await response.json();
  const user = data.data.user;
  // job-033: mypage 는 이제 소속 목록을 함께 내려준다. JWT 에 tenantId 가 없으므로
  // 활성 매장은 이 목록에서 골라 헤더로 알려줘야 한다.
  const memberships = data.data.memberships ?? [];

  if (user.status !== "ACTIVE") {
    redirect("/auth/login?error=inactive");
  }

  // job-038: admin 앱은 플랫폼 운영자 전용이다. 매장 운영 화면은 전부 apps/web 의
  // `/[tenant]/…` 로 옮겨졌으므로, 여기서 통과해야 할 계정은 SUPER_ADMIN 하나뿐이다.
  //
  // 로그인 폼(useLogin)의 역할 검사만으로는 부족하다 — 쿠키는 프로덕션에서
  // `.${SERVER_NAME}` 도메인으로 발급되므로(apps/api/src/shared/utils/cookie.ts),
  // apps/web 에서 로그인한 일반 회원의 세션이 admin 서브도메인에도 그대로 전달된다.
  // 즉 로그인 폼을 거치지 않고 URL 로 바로 들어오는 경로가 존재한다.
  if (user.role !== ROLES.SUPER_ADMIN) {
    redirect("/auth/login?error=forbidden");
  }

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("accessToken");
    cookieStore.delete("refreshToken");
    redirect("/auth/login");
  };

  return (
    <div className='flex h-screen w-screen overflow-hidden bg-background'>
      <TenantSync memberships={memberships} />
      <Sidebar user={user} onLogout={handleLogout} />
      <main className='flex-1 overflow-y-auto bg-background p-8 text-foreground'>
        <div className='mx-auto w-full max-w-[1600px]'>{children}</div>
      </main>
    </div>
  );
};

export default layout;

export { getMe };
