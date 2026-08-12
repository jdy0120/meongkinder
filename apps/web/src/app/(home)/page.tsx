import type { Metadata } from "next";

import { LandingPage } from "@/views";

export const metadata: Metadata = {
  // 랜딩은 브랜드명 자체가 제목이라 root layout 의 "%s · Pawlog Kids" 템플릿을 쓰지 않는다.
  title: {
    absolute: "Pawlog Kids — 우리 아이의 하루를 전하는 펫 유치원 알림장",
  },
  description:
    "무엇을 먹었고 얼마나 잤는지, 오늘은 누구와 놀았는지까지. 선생님이 남긴 하루를 사진과 함께 그대로 받아보세요. 설치 없이 카카오 계정으로 바로 시작합니다.",
  openGraph: {
    title: "Pawlog Kids — 우리 아이의 하루를 전하는 펫 유치원 알림장",
    description:
      "출석 체크부터 알림장 발행, 이용권 관리까지. 보호자와 유치원이 같은 앱에서 하루를 나눕니다.",
    type: "website",
  },
};

export default function Page() {
  return <LandingPage />;
}
