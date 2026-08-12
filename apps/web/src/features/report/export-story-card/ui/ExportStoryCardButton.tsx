"use client";

import { Share2 } from "lucide-react";
import { Button } from "@pawlog/ui";
import type { DailyReportWithPetAndContents } from "@pawlog/shared";

import { useExportStoryCard } from "../model/useExportStoryCard";

/** 인스타 스토리용 이미지 카드 내보내기 버튼 (feature ui) */
export const ExportStoryCardButton = ({
  report,
}: {
  report: DailyReportWithPetAndContents;
}) => {
  const { exportCard, isExporting } = useExportStoryCard(report);

  return (
    <Button onClick={exportCard} disabled={isExporting} className='w-full gap-2'>
      <Share2 className='size-4' />
      {isExporting ? "카드 생성 중…" : "인스타 스토리로 공유하기"}
    </Button>
  );
};
