"use client";

import { Card, CardContent, Spinner } from "@pawlog/ui";

import { PageShell } from "@/shared/ui";
import {
  ConditionSummary,
  getPhotoContents,
  ReportPhotoTile,
  useMyDailyReport,
} from "@/entities/daily-report";
import { PetAvatar } from "@/entities/pet";
import { ExportStoryCardButton } from "@/features/report/export-story-card";
import { MobileNav } from "@/widgets/mobile-nav";

/**
 * 리포트 상세 화면 (view) — 사진 갤러리 · 컨디션 요약 · 코멘트를 보여주고
 * 인스타 스토리용 이미지 카드 내보내기 기능을 제공한다.
 */
export const ReportDetailPage = ({ reportId }: { reportId: string }) => {
  const { data: report, isLoading } = useMyDailyReport(reportId);

  return (
    <PageShell
      title='리포트 상세'
      backHref='/reports'
      width='md'
      nav={<MobileNav />}
    >
      {isLoading ? (
          <div className='flex justify-center py-16'>
            <Spinner className='size-6' />
          </div>
        ) : !report ? (
          <p className='py-16 text-center text-sm text-muted-foreground'>
            존재하지 않거나 아직 발행되지 않은 리포트예요.
          </p>
        ) : (
          <div className='flex flex-col gap-6'>
            <div className='flex items-center gap-3'>
              <PetAvatar name={report.pet.name} className='size-12' />
              <div>
                <p className='font-semibold'>{report.pet.name}</p>
                <p className='text-sm text-muted-foreground'>
                  {new Date(report.date).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}
                </p>
              </div>
            </div>

            {getPhotoContents(report.contents).length > 0 && (
              <div className='grid grid-cols-3 gap-2'>
                {getPhotoContents(report.contents).map((photo) => (
                  <ReportPhotoTile
                    key={photo.id}
                    fileId={photo.fileId as string}
                    className='aspect-square'
                  />
                ))}
              </div>
            )}

            <section className='space-y-2'>
              <h2 className='text-sm font-semibold text-muted-foreground'>오늘의 컨디션</h2>
              <ConditionSummary contents={report.contents} />
            </section>

            {(report.summary || report.aiCommentDraft) && (
              <Card>
                <CardContent className='pt-4'>
                  <p className='text-xs font-medium text-muted-foreground'>선생님 코멘트</p>
                  <p className='mt-1 whitespace-pre-wrap text-sm'>
                    {report.summary || report.aiCommentDraft}
                  </p>
                </CardContent>
              </Card>
            )}

            <ExportStoryCardButton report={report} />
          </div>
        )}
    </PageShell>
  );
};
