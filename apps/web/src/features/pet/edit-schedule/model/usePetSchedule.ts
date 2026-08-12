"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PetScheduleResponse,
  UpdatePetScheduleRequest,
} from "@pawlog/shared";

import { Get, Put } from "@/shared/libs/axios/request";

/**
 * 등원 스케줄 조회/저장 (job-053).
 *
 * 펫 수정(`useUpdatePet`)과 분리한 이유는 저장 단위가 다르기 때문이다 — 펫 정보는 부분
 * 수정이고, 날짜 지정 스케줄은 **그 달을 통째로 교체**한다(체크를 푼 날짜가 빠져야 한다).
 * 한 폼에 섞으면 "안 보낸 필드"와 "비운 달"을 구분할 수 없다.
 */
export const usePetSchedule = (petId: string, month: string, enabled = true) =>
  useQuery({
    queryKey: ["pet-schedule", petId, month],
    enabled,
    queryFn: async () => {
      const res = await Get<PetScheduleResponse, { month: string }>(
        `/v1/admin/pets/${petId}/schedule`,
        { month },
      );
      return res.data.data;
    },
  });

export const useUpdatePetSchedule = (petId: string, onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdatePetScheduleRequest) => {
      const res = await Put(`/v1/admin/pets/${petId}/schedule`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success("등원 스케줄이 저장되었습니다.");
      // 스케줄을 바꾸면 오늘의 출석부에 그 아이가 새로 뜨거나 빠진다. 원생 목록도
      // 오늘의 출석을 함께 싣고 있으므로(job-052) 같이 무효화한다.
      queryClient.invalidateQueries({ queryKey: ["pet-schedule", petId] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      queryClient.invalidateQueries({ queryKey: ["pet-summary"] });
      onSuccess?.();
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "저장에 실패했습니다.";
      toast.error(msg);
    },
  });
};
