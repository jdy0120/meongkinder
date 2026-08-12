import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

  // job-041: 필수 약관에 아직 동의하지 않았으면 어떤 화면도 열어주지 않는다.
  //
  // 카카오 로그인은 약관 동의 절차를 거치지 않으므로(social-auth.service.ts 는
  // UserTermsAgreement 를 만들지 않는다) apps/web 사용자는 **전원** 이 상태로 시작한다.
  // 게이트를 여기 두는 이유는 (checkauth) 가 이미 매 요청 mypage 를 부르고 있어서
  // 추가 요청 없이 판단할 수 있고, 개별 페이지에 흩어두면 새 라우트를 추가할 때마다
  // 빠뜨리기 때문이다.
  //
  // `/welcome` 은 이 그룹 **바깥**에 있다 — 여기 안에 두면 게이트가 자기 자신으로
  // 리다이렉트해 무한 루프가 된다. 대신 그쪽에서 직접 getMe 로 인증을 확인한다.
  const pendingRequiredTerms = data.data.pendingRequiredTerms ?? [];
  if (pendingRequiredTerms.length > 0) {
    redirect("/welcome");
  }

  if (user.status === "ACTIVE") {
    return (
      // ⚠️ 여기에 `overflow-y-auto` 를 붙이지 말 것 (job-049).
      // 스크롤은 `(home)/layout.tsx` 의 `div.flex-1.overflow-y-auto` 가 소유한다 —
      // body 스크롤이 막혀 있어(globals.css) 그 하나만 실제로 스크롤된다.
      // 이 래퍼에 overflow 를 주면 **높이가 auto 라 스크롤되지도 않으면서**
      // 스크롤 컨테이너로만 잡혀, 안쪽 `PageShell` 의 `sticky` 헤더와 하단 탭이
      // 전부 무력화된다(sticky 는 가장 가까운 스크롤 컨테이너를 기준으로 붙는데,
      // 그게 절대 스크롤되지 않는 상자가 되어버린다). 콘텐츠가 한 화면을 넘는
      // 피드 화면에서 하단 탭이 같이 밀려 올라가던 원인이 이것이었다.
      <main>
        <TenantSync memberships={memberships} />
        {children}
      </main>
    );
  }

  if (user.status === "PENDING") {
    redirect("/auth/pending");
  }

  redirect("/auth/not-auth");
};

export default layout;

export { getMe };
