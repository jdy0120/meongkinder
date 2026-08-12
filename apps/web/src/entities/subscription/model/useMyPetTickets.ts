"use client";

import { useQuery } from "@tanstack/react-query";
import type { MyLedgerResponse } from "@pawlog/shared";

import { Get } from "@/shared/libs/axios/request";

/**
 * 보호자 - **아이별** 이용권 잔액과 최근 사용 내역 (job-046).
 *
 * `useMyTickets`(매장 구독 단위)와 다른 축이다. 잔액은 아이 단위로 쌓이므로(job-045)
 * 형제견을 맡긴 보호자는 "초코 10회 / 두부 5회"처럼 따로 봐야 한다 — 합계 하나로는
 * 어느 쪽이 곧 떨어지는지 알 수 없다. 아이 수는 많아야 서너 마리라 서버가 전부 내려준다.
 */
export const useMyPetTickets = () =>
  useQuery({
    queryKey: ["subscription-ledgers", "mine"],
    queryFn: async () => {
      const res = await Get<MyLedgerResponse, undefined>(
        "/v1/subscriptions/ledgers/mine",
      );
      return res.data.data?.pets ?? [];
    },
  });
