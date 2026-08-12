import { LoginPage } from "@/views";
import React from "react";

// Next.js 16: searchParams 는 Promise 로 전달된다.
interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

const page = async ({ searchParams }: PageProps) => {
  const { error } = await searchParams;

  return <LoginPage error={error} />;
};

export default page;
