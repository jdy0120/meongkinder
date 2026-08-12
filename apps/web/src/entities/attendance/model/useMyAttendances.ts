"use client";

import { useQuery } from "@tanstack/react-query";
import type { AttendanceWithPet } from "@pawlog/shared";

import { GetList } from "@/shared/libs/axios/request";

/**
 * 보호자 - 내 아이 등원 이력 (job-046).
 *
 * 회수권을 파는 서비스인데 보호자가 "이번 달 몇 번 갔지"를 볼 수 없었다. 알림장은 보는데
 * 출석은 못 봐서 잔여 횟수가 맞는지 확인할 방법이 아예 없었다.
 * 매장 스코프가 아니라 "내 아이"가 기준이라 여러 매장에 맡겨도 한 번에 보인다.
 */
export const useMyAttendances = (petId?: string) =>
  useQuery({
    queryKey: ["attendances", "mine", petId ?? "all"],
    queryFn: async () => {
      const res = await GetList<AttendanceWithPet>("/v1/attendances/mine", {
        pageSize: 30,
        ...(petId ? { petId } : {}),
      });
      return res.data.data?.items ?? [];
    },
  });
