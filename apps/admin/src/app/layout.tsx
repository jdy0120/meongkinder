import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "template",
  description: "template web 입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ko' suppressHydrationWarning>
      <head>
        {/* apps/web 과 같은 폰트를 쓴다 — 토큰을 공유하는데 폰트만 다르면 갈라진다. */}
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
