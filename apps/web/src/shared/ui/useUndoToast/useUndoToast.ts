"use client";

import { useCallback } from "react";
import { toast } from "sonner";

/** 되돌리기를 띄워 두는 시간. 스펙 §3.2 고정값. */
const UNDO_DURATION_MS = 8_000;

interface UndoToastOptions {
  /** 무엇이 일어났는지. 예: "초코 등원 처리했어요" */
  message: string;
  /** 되돌리기를 눌렀을 때 실행할 것. 실패하면 사용자에게 알린다. */
  onUndo: () => void | Promise<unknown>;
  /** 보조 설명 (예: 처리 시각). */
  description?: string;
}

/**
 * 8초 되돌리기 토스트 (design-system.md §3.2 MUST).
 *
 * 이 앱의 오터치 대책은 **막는 것이 아니라 되돌리는 것**이다. 젖은 손으로 조작하는 이상
 * 오터치는 반드시 일어나는데, 확인 다이얼로그로 막으면 하루 20번 반복되는 등하원 체크가
 * 전부 2탭이 되어 결국 앱 밖에서 처리하게 된다. 그래서 한 번에 실행하고 8초를 준다.
 *
 * 8초인 이유: 3~5초는 강아지를 안은 채 화면을 다시 보기 전에 사라지고, 10초를 넘기면
 * 다음 아이를 처리하는 동안 토스트가 화면을 가린다.
 *
 * ⚠️ 되돌리기를 붙일 수 없는 동작(외부로 이미 알림톡이 나간 발행 등)은 이 훅을 쓰지 말고
 * 하단 시트로 **미리** 확인받는다 — 되돌릴 수 없는 것을 되돌릴 수 있는 척하면 안 된다.
 */
export const useUndoToast = () => {
  return useCallback(({ message, onUndo, description }: UndoToastOptions) => {
    toast.success(message, {
      description,
      duration: UNDO_DURATION_MS,
      action: {
        label: "되돌리기",
        onClick: () => {
          void (async () => {
            try {
              await onUndo();
              toast.success("되돌렸어요");
            } catch {
              // 되돌리기가 조용히 실패하면 사용자는 되돌아간 줄 안다. 그게 제일 위험하다.
              toast.error("되돌리지 못했어요. 화면을 새로고침해 확인해 주세요.");
            }
          })();
        },
      },
    });
  }, []);
};
