"use client";

import { FileText } from "lucide-react";
import {
  Button,
  Spinner,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pawlog/ui";

import { usePreviewTerms } from "../model/usePreviewTerms";

interface TermsPreviewDialogProps {
  previewId: string | null;
  onClose: () => void;
}

/**
 * 약관 본문 미리보기 다이얼로그 (feature ui).
 * 업로드된 문서를 sandbox iframe 으로 앱 오리진과 격리해 렌더링한다(XSS 차단).
 */
export const TermsPreviewDialog = ({
  previewId,
  onClose,
}: TermsPreviewDialogProps) => {
  const { data: previewTerms, isLoading } = usePreviewTerms(previewId);

  return (
    <Dialog
      open={!!previewId}
      onOpenChange={(open: boolean) => !open && onClose()}
    >
      <DialogContent className='flex max-h-[85vh] flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl'>
        {/* 제목이 닫기 버튼에 깔리던 자리 — 이제 admin 테마가 헤더에 56px 를 비워 둔다
            (globals.css ②). 예전의 `pr-6` 임시 처치는 24px 라 여전히 모자랐다. */}
        <DialogHeader className='shrink-0'>
          <DialogTitle className='flex items-center gap-2 text-card text-foreground'>
            <FileText className='size-5 shrink-0 text-brand' />
            <span className='truncate'>
              {previewTerms?.title}
              {previewTerms?.version && (
                <span className='ml-1.5 font-mono text-body-sm font-normal text-text-meta'>
                  v{previewTerms.version}
                </span>
              )}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className='flex-1 overflow-hidden rounded-2xl p-2 neu-inset'>
          {isLoading ? (
            <div className='flex items-center justify-center py-20'>
              <Spinner className='size-6 text-brand' />
            </div>
          ) : previewTerms?.content ? (
            <iframe
              title={`${previewTerms.title ?? "약관"} 본문 미리보기`}
              srcDoc={previewTerms.content}
              sandbox=''
              className='h-full min-h-[50vh] w-full rounded-xl border-0 bg-white'
            />
          ) : (
            <div className='py-20 text-center text-text-meta'>
              본문 내용을 불러올 수 없거나 파일 내용이 비어있습니다.
            </div>
          )}
        </div>

        <DialogFooter className='shrink-0'>
          <Button
            size='sm'
            variant='outline'
            onClick={onClose}
            className='cursor-pointer border-transparent bg-transparent px-6 text-text-muted neu-press'
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
