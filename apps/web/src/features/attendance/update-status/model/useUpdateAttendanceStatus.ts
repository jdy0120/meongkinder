"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdateAttendanceStatusRequest } from "@pawlog/shared";

import { Patch } from "@/shared/libs/axios/request";

/**
 * 결석/보강/취소 처리 뮤테이션 (feature model). 성공 시 오늘의 출석부 목록 캐시를 무효화한다.
 */
export const useUpdateAttendanceStatus = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: UpdateAttendanceStatusRequest & { id: string }) => {
      const res = await Patch(`/v1/attendances/${id}/status`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("출석 상태가 처리되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "처리에 실패했습니다.";
      toast.error(msg);
    },
  });
};
