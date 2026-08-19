"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@pawlog/ui";

import { useActiveTerms } from "../model/useActiveTerms";

interface TermsContentDialogProps {
  termsId: string;
  title: string;
}

/**
 * 약관 본문 다이얼로그 (entity ui).
 *
 * 별도 라우트(`/terms/...`)를 두지 않는다 — `apps/web` 에 약관 뷰어 페이지가 없어서
 * 링크로 걸면 404 가 나고, 동의 화면에서 페이지를 떠나면 체크해 둔 것이 날아간다.
 * 본문은 열었을 때만 가져온다(`enabled`).
 */
export const TermsContentDialog = ({
  termsId,
  title,
}: TermsContentDialogProps) => {
  const [open, setOpen] = useState(false);
  const { data: terms, isLoading } = useActiveTerms();

  const content = terms?.find((item) => item.id === termsId)?.content;

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='text-xs text-muted-foreground underline underline-offset-2'
      >
        보기
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-h-[80vh] overflow-x-hidden overflow-y-auto sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className='flex justify-center py-5'>
              <Spinner className='size-5' />
            </div>
          ) : (
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>
              {content || "약관 본문을 불러올 수 없습니다."}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
