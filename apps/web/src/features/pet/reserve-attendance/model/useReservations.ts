"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateReservationRequest,
  CreateReservationResponse,
  ReservationCalendarResponse,
} from "@pawlog/shared";

import { Delete, Get, Post } from "@/shared/libs/axios/request";

const calendarKey = (petId: string, month: string) => [
  "pet-reservations",
  petId,
  month,
];

/**
 * 예약 달력 (job-060).
 *
 * 판정(운영일인가·잔액이 남았나·이미 잡혔나)은 전부 서버가 끝내서 내려준다. 화면이
 * 다시 계산하지 않는 이유는, 같은 규칙이 두 곳에 생기면 **달력에서는 눌리는데 저장하면
 * 400 이 나는** 상태가 반드시 만들어지기 때문이다. 잔액처럼 다른 사람(원장)이 바꾸는
 * 값은 특히 그렇다.
 */
export const useReservationCalendar = (petId: string, month: string) =>
  useQuery({
    queryKey: calendarKey(petId, month),
    // 아이를 고르기 전에는 부르지 않는다.
    enabled: Boolean(petId),
    queryFn: async () => {
      const res = await Get<ReservationCalendarResponse, { month: string }>(
        `/v1/pets/${petId}/reservations`,
        { month },
      );
      return res.data.data ?? null;
    },
  });

/**
 * 예약 추가.
 *
 * ⚠️ 성공 후 **그 아이의 달력 전체**를 무효화한다(달 단위 키까지 내려가지 않는다).
 * 예약은 "남은 횟수"를 바꾸는데 그 값은 모든 달의 응답에 실려 있어서, 보고 있는 달만
 * 다시 부르면 옆 달로 넘어갔을 때 낡은 잔여 횟수로 판정된 달력을 보게 된다.
 */
export const useCreateReservation = (petId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateReservationRequest) => {
      const res = await Post<
        CreateReservationResponse,
        CreateReservationRequest
      >(`/v1/pets/${petId}/reservations`, payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["pet-reservations", petId],
      });
      // 출석 이력·이용권 잔액 화면도 같은 사실을 보고 있다.
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      toast.success(
        `등원 예약이 완료되었습니다. 남은 예약 가능 횟수 ${data?.remaining ?? 0}회`,
      );
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? "예약에 실패했습니다.");
    },
  });
};

export const useCancelReservation = (petId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) => {
      const res = await Delete<{ canceled: string }>(
        `/v1/pets/${petId}/reservations/${date}`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["pet-reservations", petId],
      });
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      toast.success("등원 예약이 취소되었습니다.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? "취소에 실패했습니다.");
    },
  });
};
