import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pawlog Kids",
    template: "%s · Pawlog Kids",
  },
  description:
    "아이의 하루를 기록하고 나누는 펫 유치원 알림장 서비스, Pawlog Kids.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ko' suppressHydrationWarning>
      <head>
        {/*
          Pretendard Variable (design-system.md §2.2).
          한글 자소 폭이 고르고 숫자 글리프가 안정적이라 픽업 시각·잔여 회차가
          세로로 나열되는 이 앱에 맞는다.

          dynamic-subset 을 쓰는 이유: 한글 전체 폰트는 1MB 를 넘는데, 현장에서
          쓰는 기기가 LTE 인 경우가 많다. 서브셋은 실제로 쓰인 글자만 받아온다.

          TODO: 폰트 파일을 저장소에 넣고 `next/font/local` 로 자체 호스팅하면
          FOUT 과 외부 의존이 함께 사라진다. 지금은 CDN 이 유일한 선택지다.
        */}
        <link rel='preconnect' href='https://cdn.jsdelivr.net' crossOrigin='' />
        <link
          rel='stylesheet'
          href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
