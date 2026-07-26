"use client";

import { FileText, Calendar } from "lucide-react";
import {
  Button,
  Spinner,
  Dialog,
  DialogContent,
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
      <DialogContent className='border-slate-800 bg-slate-900 text-slate-100 sm:max-w-2xl max-w-2xl max-h-[80vh] flex flex-col overflow-hidden backdrop-blur-md rounded-2xl'>
        <DialogHeader className='shrink-0 border-b border-slate-800 pb-4'>
          <DialogTitle className='text-xl font-bold text-white flex items-center gap-2 justify-between w-full pr-6'>
            <span className='flex items-center gap-2'>
              <FileText className='w-5 h-5 text-blue-500' />
              {previewTerms?.title} (v{previewTerms?.version})
            </span>
            <span className='text-xs font-mono text-slate-400 font-normal flex items-center gap-1'>
              <Calendar className='w-3 h-3' />
              본문 미리보기
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className='flex-1 overflow-hidden p-2 bg-slate-950 rounded-xl mt-3'>
          {isLoading ? (
            <div className='flex justify-center items-center py-20'>
              <Spinner className='w-6 h-6 text-blue-500' />
            </div>
          ) : previewTerms?.content ? (
            <iframe
              title={`${previewTerms.title ?? "약관"} 본문 미리보기`}
              srcDoc={previewTerms.content}
              sandbox=''
              className='w-full h-full min-h-[50vh] rounded-lg border-0 bg-white'
            />
          ) : (
            <div className='text-center py-20 text-slate-500'>
              본문 내용을 불러올 수 없거나 파일 내용이 비어있습니다.
            </div>
          )}
        </div>

        <div className='shrink-0 flex justify-end pt-4 border-t border-slate-800 mt-3'>
          <Button
            onClick={onClose}
            className='bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl'
          >
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
