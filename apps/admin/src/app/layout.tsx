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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
