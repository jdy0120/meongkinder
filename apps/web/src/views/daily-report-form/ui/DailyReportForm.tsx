"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { CreateReportContentRequest, PetWithOwner } from "@pawlog/shared";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
} from "@pawlog/ui";

import { DatePicker, PageShell } from "@/shared/ui";
import { tenantPath } from "@/shared/libs/tenant/routes";
import { usePetOptions } from "@/entities/pet";
import {
  QUICK_PHRASES_BY_TYPE,
  REPORT_CONTENT_TYPE_OPTIONS,
  reportContentTypeLabelMap,
  useDailyReport,
  type DailyReportWithContents,
} from "@/entities/daily-report";
import { MultiPhotoUpload, type PhotoTagItem } from "@/features/file/upload-multi";
import { useCreateDailyReport } from "@/features/daily-report/create";
import { useUpdateDailyReport } from "@/features/daily-report/edit";
import { MobileNav } from "@/widgets/mobile-nav";

interface DailyReportFormProps {
  mode: "create" | "edit";
  reportId?: string;
}

interface ContentEntryState {
  id: string;
  type: string;
  content: string;
}

const toDateInputValue = (value?: string | Date | null) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

const buildInitialContentItems = (
  report: DailyReportWithContents | null,
): ContentEntryState[] =>
  report
    ? [...report.contents]
        .sort((a, b) => a.order - b.order)
        .filter((content) => content.type !== "PHOTO")
        .map((content) => ({
          id: content.id,
          type: content.type,
          content: content.content ?? "",
        }))
    : [];

const buildInitialPhotos = (
  report: DailyReportWithContents | null,
): PhotoTagItem[] =>
  report
    ? [...report.contents]
        .sort((a, b) => a.order - b.order)
        .filter((content) => content.type === "PHOTO" && content.fileId)
        .map((content) => ({
          fileId: content.fileId as string,
          previewUrl: null,
          label: "기존 사진",
          petIds: [],
        }))
    : [];

/**
 * 일일 리포트 작성/수정 화면 (view).
 * 수정 모드에서는 기존 리포트 로딩이 끝난 뒤에만 아래 본체를 마운트해
 * 최초 렌더 시점에 로컬 상태를 한 번만 초기화한다 (effect 로 상태를 동기화하지 않음).
 */
export const DailyReportForm = ({ mode, reportId }: DailyReportFormProps) => {
  const {
    data: existingReport,
    isLoading: isLoadingReport,
    isError: isReportError,
  } = useDailyReport(reportId ?? "");

  if (mode === "edit" && isLoadingReport) {
    return (
      <div className='flex justify-center items-center py-24'>
        <Spinner className='w-8 h-8 text-primary' />
      </div>
    );
  }

  if (mode === "edit" && (isReportError || !existingReport)) {
    return (
      <div className='py-24 text-center text-sm text-muted-foreground'>
        일일 리포트를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <DailyReportFormBody
      mode={mode}
      reportId={reportId}
      existingReport={mode === "edit" ? (existingReport ?? null) : null}
    />
  );
};

interface DailyReportFormBodyProps {
  mode: "create" | "edit";
  reportId?: string;
  existingReport: DailyReportWithContents | null;
}

const DailyReportFormBody = ({
  mode,
  reportId,
  existingReport,
}: DailyReportFormBodyProps) => {
  const router = useRouter();
  // 매장 경로(/tenant/<subdomain>/…)를 유지한 채 이동하기 위해 현재 매장 세그먼트를 읽는다.
  const { tenant } = useParams<{ tenant: string }>();
  const { data: pets = [] } = usePetOptions();
  const createDailyReport = useCreateDailyReport();
  const updateDailyReport = useUpdateDailyReport();

  const [petId, setPetId] = useState(existingReport?.petId ?? "");
  const [date, setDate] = useState(
    () =>
      toDateInputValue(existingReport?.date) ||
      new Date().toISOString().slice(0, 10),
  );
  const [summary, setSummary] = useState(existingReport?.summary ?? "");
  const [aiDraft, setAiDraft] = useState<string | null>(
    existingReport?.aiCommentDraft ?? null,
  );
  const [photos, setPhotos] = useState<PhotoTagItem[]>(() =>
    buildInitialPhotos(existingReport),
  );
  const [contentItems, setContentItems] = useState<ContentEntryState[]>(() =>
    buildInitialContentItems(existingReport),
  );

  const isSaving = createDailyReport.isPending || updateDailyReport.isPending;
  const selectedPet = pets.find((pet: PetWithOwner) => pet.id === petId);

  const addContentEntry = (type: string) => {
    setContentItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type, content: "" },
    ]);
  };

  const updateContentEntry = (id: string, content: string) => {
    setContentItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item)),
    );
  };

  const removeContentEntry = (id: string) => {
    setContentItems((prev) => prev.filter((item) => item.id !== id));
  };

  const appendQuickPhrase = (id: string, phrase: string) => {
    setContentItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              content: item.content ? `${item.content}, ${phrase}` : phrase,
            }
          : item,
      ),
    );
  };

  const buildContents = (
    photosForPet: PhotoTagItem[],
  ): CreateReportContentRequest[] => {
    const entries: CreateReportContentRequest[] = contentItems
      .filter((item) => item.content.trim().length > 0)
      .map((item, index) => ({
        type: item.type,
        content: item.content,
        order: index,
      }));
    const photoEntries: CreateReportContentRequest[] = photosForPet.map(
      (photo, index) => ({
        type: "PHOTO",
        fileId: photo.fileId,
        order: entries.length + index,
      }),
    );
    return [...entries, ...photoEntries];
  };

  const validate = () => {
    if (!petId) {
      toast.error("아이를 선택해주세요.");
      return false;
    }
    if (!date) {
      toast.error("날짜를 선택해주세요.");
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    const contents = buildContents(photos);

    try {
      if (mode === "create") {
        const dailyReport = await createDailyReport.mutateAsync({
          petId,
          date,
          summary: summary || undefined,
          status: "DRAFT",
          contents,
        });
        setAiDraft(dailyReport.aiCommentDraft);
        toast.success("임시저장되었습니다. AI 코멘트 초안을 확인해보세요.");
        // 이후 저장부터는 새 리포트가 아닌 방금 만든 리포트를 수정하도록 전환한다
        // (반복 임시저장 시 리포트가 중복 생성되는 것을 방지).
        // 매장 경로를 붙이지 않으면 개인 스코프의 없는 주소로 나가 404 가 된다.
        router.replace(
          tenantPath(tenant, "daily-reports", dailyReport.id, "edit"),
        );
      } else if (reportId) {
        const dailyReport = await updateDailyReport.mutateAsync({
          id: reportId,
          data: { date, summary: summary || undefined, status: "DRAFT", contents },
        });
        setAiDraft(dailyReport.aiCommentDraft);
        toast.success("임시저장되었습니다. AI 코멘트 초안을 확인해보세요.");
      }
    } catch {
      // onError 뮤테이션 핸들러에서 이미 toast 처리
    }
  };

  const handlePublish = async () => {
    if (!validate()) return;
    const contents = buildContents(photos);

    try {
      if (mode === "create") {
        const dailyReport = await createDailyReport.mutateAsync({
          petId,
          date,
          summary: summary || undefined,
          status: "PUBLISHED",
          contents,
        });
        setAiDraft(dailyReport.aiCommentDraft);
      } else if (reportId) {
        const dailyReport = await updateDailyReport.mutateAsync({
          id: reportId,
          data: {
            date,
            summary: summary || undefined,
            status: "PUBLISHED",
            contents,
          },
        });
        setAiDraft(dailyReport.aiCommentDraft);
      }

      // 사진에 함께 태그된 다른 아이들에게는 그 사진을 포함한 리포트를 자동으로 만들어준다
      // (여러 아이가 함께 찍힌 사진을 일괄 태깅했을 때의 확장 흐름).
      const secondaryPetIds = [
        ...new Set(photos.flatMap((photo) => photo.petIds)),
      ].filter((id) => id !== petId);

      for (const secondaryPetId of secondaryPetIds) {
        const secondaryPhotos = photos.filter((photo) =>
          photo.petIds.includes(secondaryPetId),
        );
        if (secondaryPhotos.length === 0) continue;
        await createDailyReport.mutateAsync({
          petId: secondaryPetId,
          date,
          status: "PUBLISHED",
          contents: buildContents(secondaryPhotos),
        });
      }

      if (secondaryPetIds.length > 0) {
        toast.success(
          `함께 태그된 아이 ${secondaryPetIds.length}명에게도 공유 사진 리포트를 생성했습니다.`,
        );
      }
      toast.success("일일 리포트가 발행되었습니다.");
      router.push(tenantPath(tenant, "daily-reports"));
    } catch {
      // onError 뮤테이션 핸들러에서 이미 toast 처리
    }
  };

  return (
    <PageShell
      title={mode === "create" ? "일일 리포트 작성" : "일일 리포트 수정"}
      description='사진·식사·배변·낮잠·활동·특이사항을 기록하고, 여러 아이가 함께 찍힌 사진은 드래그로 선택해 한 번에 태그할 수 있습니다.'
      backHref={tenantPath(tenant, "daily-reports")}
      // 모바일에서는 지금까지처럼 하단 탭 없이 뒤로가기만 (집중 플로우).
      // 데스크톱은 좌측이 비어 있으므로 사이드바만 붙인다. 폼이라 폭은 넓히지 않는다.
      nav={<MobileNav withBottomBar={false} />}
      desktopSidebar
    >
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base font-semibold'>
            기본 정보
          </CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label className='text-sm font-semibold'>
              아이 태그
            </Label>
            {mode === "create" ? (
              <Select value={petId} onValueChange={setPetId}>
                <SelectTrigger className='w-full rounded-xl'>
                  <SelectValue placeholder='아이 선택' />
                </SelectTrigger>
                <SelectContent className='rounded-xl'>
                  {pets.map((pet) => (
                    <SelectItem key={pet.id} value={pet.id}>
                      {pet.name} ({pet.user?.nickname ?? "계정 미연결"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className='flex h-9 items-center rounded-xl border px-3'>
                <Badge className='bg-primary/10 text-primary border-primary/20'>
                  {selectedPet ? selectedPet.name : petId}
                </Badge>
              </div>
            )}
          </div>

          <div className='space-y-2'>
            <Label className='text-sm font-semibold'>
              리포트 대상 일자
            </Label>
            <DatePicker
              value={date}
              onChange={setDate}
              // 아직 오지 않은 날의 리포트는 존재할 수 없다.
              disabled={{ after: new Date() }}
              // 대상 일자는 비울 수 없다 — 저장 시 반드시 하루를 가리켜야 한다.
              clearable={false}
            />
          </div>
        </CardContent>
      </Card>

      {!petId ? (
        <Card className='text-muted-foreground text-sm'>
          <CardContent className='py-10 text-center'>
            먼저 아이를 선택하면 사진 업로드와 항목 입력을 진행할 수 있습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base font-semibold'>
                사진
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MultiPhotoUpload
                pets={pets
                  .filter((pet) => pet.id !== petId)
                  .map((pet) => ({ id: pet.id, name: pet.name }))}
                value={photos}
                onChange={setPhotos}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base font-semibold'>
                식사 · 배변 · 낮잠 · 활동 · 특이사항
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex flex-wrap gap-2'>
                {REPORT_CONTENT_TYPE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type='button'
                    variant='outline'
                   
                    onClick={() => addContentEntry(option.value)}
                    className='gap-1.5 rounded-full'
                  >
                    <Plus className='w-3.5 h-3.5' />
                    {option.label}
                  </Button>
                ))}
              </div>

              {contentItems.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  위 버튼을 눌러 오늘 있었던 일을 기록해보세요.
                </p>
              ) : (
                <div className='space-y-3'>
                  {contentItems.map((item) => (
                    <div
                      key={item.id}
                      className='space-y-2 rounded-xl border p-3'
                    >
                      <div className='flex items-center justify-between'>
                        <Badge variant='secondary'>
                          {reportContentTypeLabelMap[item.type] ?? item.type}
                        </Badge>
                        <button
                          type='button'
                          aria-label='항목 삭제'
                          onClick={() => removeContentEntry(item.id)}
                          className='rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive'
                        >
                          <X className='w-4 h-4' />
                        </button>
                      </div>

                      <div className='flex flex-wrap gap-1.5'>
                        {(QUICK_PHRASES_BY_TYPE[item.type] ?? []).map(
                          (phrase) => (
                            <button
                              key={phrase}
                              type='button'
                              onClick={() => appendQuickPhrase(item.id, phrase)}
                              className='cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-accent'
                            >
                              {phrase}
                            </button>
                          ),
                        )}
                      </div>

                      <Textarea
                        rows={2}
                        value={item.content}
                        onChange={(e) =>
                          updateContentEntry(item.id, e.target.value)
                        }
                        placeholder='내용을 입력하거나 위 버튼으로 빠르게 채워보세요.'
                        className='rounded-xl'
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base font-semibold'>
            총평 요약
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Textarea
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder='보호자에게 전달할 한 줄 총평을 작성하세요. 임시저장하면 AI 코멘트 초안을 참고할 수 있습니다.'
            className='rounded-xl'
          />

          {aiDraft && (
            /* job-052: amber-* 하드코딩 → caution 토큰. 이 블록은 "아직 사람이 확인하지
               않은 초안"이라 정확히 caution 이고, 색을 새로 만들 이유가 없다.
               (이전 amber-300/amber-100 조합은 거의 흰 배경 위라 글자가 안 보였다.) */
            <div className='space-y-3 rounded-xl bg-caution-tint p-4 text-caution-text'>
              <div className='flex items-center gap-2 text-label font-semibold'>
                <Sparkles className='size-4' />
                AI 코멘트 초안
              </div>
              <p className='text-body whitespace-pre-wrap'>{aiDraft}</p>
              <Button
                type='button'
                variant='outline'
                onClick={() => setSummary(aiDraft)}
              >
                요약에 반영
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 폼이 길어 스크롤 끝까지 내려가야 저장할 수 있었다. 하단에 고정해 둔다. */}
      <div className='sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6'>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.push(tenantPath(tenant, "daily-reports"))}
          className='rounded-xl'
        >
          취소
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={isSaving}
          onClick={handleSaveDraft}
          className='gap-1.5 rounded-xl'
        >
          {isSaving && <Spinner className='w-4 h-4' />}
          임시저장 (AI 초안 생성)
        </Button>
        <Button
          type='button'
          disabled={isSaving}
          onClick={handlePublish}
          className='gap-1.5 rounded-xl font-semibold shadow-lg shadow-primary/20'
        >
          {isSaving && <Spinner className='w-4 h-4' />}
          발행
        </Button>
      </div>
    </PageShell>
  );
};
