import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Card, CardContent } from "@pawlog/ui";
import type { DailyReportWithPetAndContents } from "@pawlog/shared";

import { PetAvatar } from "@/entities/pet";

import { getNoteContents, getPhotoContents } from "../lib/options";
import { ConditionSummary } from "./ConditionSummary";
import { ReportPhotoTile } from "./ReportPhotoTile";

/**
 * 리포트 아카이브 목록의 카드 한 장 (entity ui) — 날짜/펫/사진 개수/컨디션 요약/코멘트 미리보기를 조합해 보여주고
 * 클릭 시 상세 페이지로 이동한다.
 */
export const ReportCard = ({
  report,
}: {
  report: DailyReportWithPetAndContents;
}) => {
  const photos = getPhotoContents(report.contents);
  const note = getNoteContents(report.contents)[0];
  const comment = report.summary || report.aiCommentDraft || note?.content;

  return (
    <Link href={`/reports/${report.id}`}>
      <Card className='transition-colors hover:bg-muted/40'>
        <CardContent className='flex flex-col gap-3 pt-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <PetAvatar name={report.pet.name} className='size-8' />
              <div>
                <p className='text-sm font-semibold'>{report.pet.name}</p>
                <p className='text-xs text-muted-foreground'>
                  {new Date(report.date).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}
                </p>
              </div>
            </div>
            {photos.length > 0 && (
              <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                <ImageIcon className='size-3.5' />
                {photos.length}
              </span>
            )}
          </div>

          {photos[0] && (
            <ReportPhotoTile
              fileId={photos[0].fileId as string}
              className='h-32 w-full'
            />
          )}

          <ConditionSummary contents={report.contents} />

          {comment && (
            <p className='line-clamp-2 text-sm text-muted-foreground'>{comment}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};
