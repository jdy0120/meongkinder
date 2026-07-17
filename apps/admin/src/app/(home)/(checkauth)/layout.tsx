import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sidebar } from "@/widgets/sidebar";

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

  if (user.status !== "ACTIVE") {
    if (user.status === "PENDING") {
      redirect("/auth/pending");
    }
    redirect("/auth/not-auth");
  }

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("accessToken");
    cookieStore.delete("refreshToken");
    redirect("/auth/login");
  };

  return (
    <div className='flex h-screen w-screen overflow-hidden bg-slate-950'>
      <Sidebar user={user} onLogout={handleLogout} />
      <main className='flex-1 overflow-y-auto bg-slate-950 p-8 text-slate-100'>
        {children}
      </main>
    </div>
  );
};

export default layout;

export { getMe };
