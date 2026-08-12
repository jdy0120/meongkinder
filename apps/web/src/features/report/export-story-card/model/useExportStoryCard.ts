"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { DailyReportWithPetAndContents, FileUrlResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";
import { getPhotoContents, groupContentsForConditionSummary } from "@/entities/daily-report";
import { getImageCrossOrigin } from "@/entities/file";

import { drawStoryCard } from "../lib/drawStoryCard";

/** 대표 사진(fileId)을 v1/file/:fileId 로 조회해 캔버스에 그릴 수 있는 이미지로 로드한다.
 *  LOCAL storage(raw 스트리밍 엔드포인트)는 쿠키 인증이 필요해 "use-credentials"로,
 *  CLOUD storage(Azure SAS URL)는 자격 증명 없이 "anonymous"로 요청해야 캔버스가 오염되지 않는다.
 *  실패해도(파일 삭제/CORS 등) 카드 생성 자체는 자리표시 프레임으로 계속 진행한다. */
const loadPhotoImage = async (fileId: string): Promise<HTMLImageElement | null> => {
  try {
    const res = await Get<FileUrlResponse, undefined>(`/v1/file/${fileId}`);
    const url = res.data.data?.url;
    if (!url) return null;

    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = getImageCrossOrigin(url);
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
};

/**
 * 인스타 스토리용 이미지 카드 내보내기 (feature model).
 * 캔버스로 카드 이미지를 그린 뒤, Web Share API(파일 공유) 를 지원하는 모바일 브라우저에서는
 * 공유 시트를 바로 띄우고, 미지원 환경(데스크톱 등)에서는 PNG 파일을 다운로드한다.
 */
export const useExportStoryCard = (report: DailyReportWithPetAndContents) => {
  const [isExporting, setIsExporting] = useState(false);

  const exportCard = async () => {
    setIsExporting(true);
    try {
      const canvas = document.createElement("canvas");
      const conditionLines = groupContentsForConditionSummary(report.contents).map(
        (group) =>
          `${group.label}: ${group.contents
            .map((content) => content.title || content.content)
            .filter(Boolean)
            .join(", ")}`,
      );

      const photos = getPhotoContents(report.contents);
      const photoImage = photos[0]?.fileId
        ? await loadPhotoImage(photos[0].fileId)
        : null;

      drawStoryCard(canvas, {
        petName: report.pet.name,
        dateLabel: new Date(report.date).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        conditionLines,
        comment: report.summary || report.aiCommentDraft || undefined,
        photoCount: photos.length,
        photoImage,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("이미지 생성에 실패했습니다.");

      const fileName = `pawlog-${report.pet.name}-${new Date(report.date)
        .toISOString()
        .slice(0, 10)}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Pawlog",
          text: `${report.pet.name}의 오늘의 리포트`,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("이미지가 저장되었어요. 인스타그램 스토리에 올려보세요!");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("이미지 카드를 만들지 못했어요.");
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCard, isExporting };
};
