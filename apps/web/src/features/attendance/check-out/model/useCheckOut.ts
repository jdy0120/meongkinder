"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CheckOutAttendanceRequest } from "@pawlog/shared";

import { Post, Patch } from "@/shared/libs/axios/request";
import { useUndoToast } from "@/shared/ui";

/**
 * 하원 체크 뮤테이션 (feature model).
 *
 * job-052: 등원과 마찬가지로 **8초 되돌리기**를 붙인다 (design-system.md §3.2).
 *
 * 되돌리기가 등원보다 단순한 이유: 하원은 이용권을 건드리지 않는다(차감은 등원 시점에
 * 이미 일어났다). 그래서 상태만 `CHECKED_IN` 으로 돌리면 되고, 별도 서버 동작 없이
 * 기존 `PATCH :id` 로 충분하다. 다만 하원 알림톡은 이미 나갔으므로 그 사실은 밝힌다.
 */
export const useCheckOut = () => {
  const queryClient = useQueryClient();
  const undoToast = useUndoToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
    queryClient.invalidateQueries({ queryKey: ["pets"] });
    queryClient.invalidateQueries({ queryKey: ["pet-summary"] });
  };

  return useMutation({
    // ⚠️ 등원과 같은 이유로 몸통을 명시적으로 만든다 — `useCheckIn` 주석 참고.
    mutationFn: async ({
      id,
      checkOutAt,
      deductSubscription,
    }: CheckOutAttendanceRequest & { id: string; petName?: string }) => {
      const res = await Post(`/v1/attendances/${id}/check-out`, {
        checkOutAt,
        deductSubscription,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      invalidate();

      undoToast({
        message: `${variables.petName ?? "원생"} 하원 처리했어요`,
        description: "보호자에게 하원 알림이 나갔습니다.",
        onUndo: async () => {
          await Patch(`/v1/attendances/${variables.id}`, {
            status: "CHECKED_IN",
          });
          invalidate();
        },
      });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "하원 처리에 실패했습니다.";
      toast.error(msg);
    },
  });
};
