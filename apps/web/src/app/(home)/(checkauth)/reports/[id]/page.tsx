import React from "react";
import { ReportDetailPage } from "@/views";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportDetailPage reportId={id} />;
}
