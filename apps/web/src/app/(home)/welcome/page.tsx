import { redirect } from "next/navigation";
import type { PendingRequiredTerms } from "@pawlog/shared";

import { getMe } from "../(checkauth)/layout";
import { WelcomePage } from "@/views";

/**
 * 최초 진입 게이트 (job-041) — 필수 약관 동의 + (선택) 전화번호.
 *
 * ## 왜 `(checkauth)` 바깥인가
 *
 * `(checkauth)` 레이아웃이 "필수 약관 미동의면 /welcome 으로" 리다이렉트하므로, 이 페이지가
 * 그 그룹 안에 있으면 **자기 자신으로 무한 리다이렉트**한다. 그래서 그룹 밖에 두고 로그인
 * 확인만 직접 한다(공개 페이지가 아니다 — 로그인해야 들어온다).
 *
 * 이미 동의를 마쳤다면 여기 머물 이유가 없으므로 `/launch` 로 보낸다(거기서 소속에 따라
 * 매장/개인 화면으로 갈린다 — job-042). 그래야 북마크나 뒤로가기로 다시 들어와도 빈 폼을
 * 마주하지 않는다.
 */
export default async function Page() {
  const response = await getMe();
  if (!response.ok) {
    redirect("/auth/login");
  }

  const data = await response.json();
  const pendingRequiredTerms: PendingRequiredTerms[] =
    data.data.pendingRequiredTerms ?? [];

  if (pendingRequiredTerms.length === 0) {
    redirect("/launch");
  }

  const hasPhone = Boolean(data.data.user?.phone);

  return <WelcomePage terms={pendingRequiredTerms} hasPhone={hasPhone} />;
}
