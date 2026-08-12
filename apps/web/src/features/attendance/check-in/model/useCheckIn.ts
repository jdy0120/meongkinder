"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CheckInAttendanceRequest } from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";
import { useUndoToast } from "@/shared/ui";

/**
 * 등원 체크 뮤테이션 (feature model).
 *
 * job-052: 성공 시 **8초 되돌리기**를 띄운다 (design-system.md §3.2).
 * 젖은 손 전제라 오터치는 반드시 일어나는데, 확인 다이얼로그로 막으면 하루 20번 반복되는
 * 체크가 전부 2탭이 되어 결국 앱 밖에서 처리하게 된다. 그래서 한 번에 실행하고 되돌린다.
 *
 * ⚠️ 되돌리기는 화면 상태만 바꾸는 게 아니라 **서버에서 이용권 차감까지 취소**한다
 * (`POST :id/undo-check-in`). 프런트에서 상태만 되돌리면 오터치 한 번에 보호자가 조용히
 * 1회를 잃는다. 다만 이미 나간 알림톡은 회수할 수 없어 그 사실을 문구로 밝힌다.
 */
export const useCheckIn = () => {
  const queryClient = useQueryClient();
  const undoToast = useUndoToast();

  // 등원/되돌리기 둘 다 원생 목록과 출석부를 동시에 바꾼다. 한쪽만 무효화하면
  // 다른 화면이 옛 상태를 계속 보여준다.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
    queryClient.invalidateQueries({ queryKey: ["pets"] });
    queryClient.invalidateQueries({ queryKey: ["pet-summary"] });
  };

  return useMutation({
    // ⚠️ 몸통은 **서버 DTO 가 받는 필드만** 명시적으로 싣는다(`...rest` 로 넘기지 않는다).
    // `petName` 은 아래 토스트 문구에만 쓰는 클라이언트 전용 값인데, 함께 실려 나가면
    // 전역 ValidationPipe(`forbidNonWhitelisted`)가 400 "property petName should not
    // exist" 로 막는다 — `CheckInAttendanceDto` 는 checkInAt/deductSubscription 만 받는다.
    mutationFn: async ({
      id,
      checkInAt,
      deductSubscription,
    }: CheckInAttendanceRequest & { id: string; petName?: string }) => {
      const res = await Post(`/v1/attendances/${id}/check-in`, {
        checkInAt,
        deductSubscription,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      invalidate();

      undoToast({
        message: `${variables.petName ?? "원생"} 등원 처리했어요`,
        description: "보호자에게 등원 알림이 나갔습니다.",
        onUndo: async () => {
          await Post(`/v1/attendances/${variables.id}/undo-check-in`, {});
          invalidate();
        },
      });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "등원 처리에 실패했습니다.";
      toast.error(msg);
    },
  });
};
