import { ResetPasswordPage } from "@/views";

// Next.js 16: searchParams 는 Promise 로 전달된다.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordPage token={token} />;
}
