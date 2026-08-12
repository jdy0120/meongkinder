"use client";

import { useQuery } from "@tanstack/react-query";
import type { MyTicketsResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";

/**
 * 나의 정기권/회수권(티켓) 목록 + 잔여 횟수.
 *
 * 서버가 **내 아이들의** 이용권만 내려준다(job-055: 계정 → 아이 → 이용권). 활성 테넌트와
 * 무관하게 같은 결과가 나오므로 쿼리 키에 tenantId 를 넣지 않는다 — 예전에는 넣어 뒀는데,
 * 그건 이 응답이 매장 단위라는 (틀린) 전제였고 매장을 열고 닫을 때마다 무의미하게 다시
 * 받아왔다. 두 유치원에 맡긴 보호자는 여기서 양쪽을 한 번에 본다.
 */
export const useMyTickets = () =>
  useQuery({
    queryKey: ["subscriptions", "my-tickets"],
    queryFn: async () => {
      const res = await Get<MyTicketsResponse, undefined>(
        "/v1/subscriptions/my-tickets",
      );
      return res.data.data?.tickets ?? [];
    },
  });
