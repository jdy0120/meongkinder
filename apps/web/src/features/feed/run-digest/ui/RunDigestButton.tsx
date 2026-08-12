"use client";

import { Loader2, NotebookPen } from "lucide-react";
import { Button } from "@pawlog/ui";

import { useRunFeedDigest } from "../model/useRunFeedDigest";

/**
 * 하루 마감 버튼 (feature ui).
 * 누르면 오늘 사진이 아이별 알림장으로 묶여 보호자에게 나간다.
 */
export const RunDigestButton = ({ className }: { className?: string }) => {
  const digest = useRunFeedDigest();

  return (
    <Button
      type='button'
      variant='outline'
      className={`gap-1.5 ${className ?? ""}`}
      disabled={digest.isPending}
      onClick={() => digest.mutate({ publish: true })}
    >
      {digest.isPending ? (
        <Loader2 className='size-4 animate-spin' />
      ) : (
        <NotebookPen className='size-4' />
      )}
      하루 마감
    </Button>
  );
};
