import React from "react";
import { SharedReportPage } from "@/views";

/**
 * 공개 알림장 (job-040) — 알림톡 링크의 도착지.
 *
 * `(checkauth)` **바깥**에 있는 것이 핵심이다. 이 링크를 받는 사람은 아직 가입하지 않았을
 * 수 있고, 그 사람에게 알림장을 보여주는 것이 이 경로의 존재 이유다.
 * 경로를 짧게(`/r/…`) 둔 이유는 SMS 폴백 시 링크가 본문 길이를 잡아먹기 때문이다.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedReportPage token={token} />;
}
