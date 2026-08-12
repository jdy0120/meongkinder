import React from "react";
import { EditDailyReportPage } from "@/views";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditDailyReportPage reportId={id} />;
}
