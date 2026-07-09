"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { Get } from "@/shared/libs/axios/request";

import type { HealthStatus, ServiceHealth } from "@/entities/system";

export interface SystemHealthView {
  /** 전체 상태: 모든 서비스 정상이면 ok, 하나라도 문제면 degraded */
  status: "ok" | "degraded";
  api: ServiceHealth;
  db: ServiceHealth;
  redis: ServiceHealth;
  uptime: number | null;
  timestamp: string;
}

/**
 * 시스템 헬스체크 조회 (feature model).
 *
 * API `/v1/health` 는 정상이면 200(+ db/redis 상세), degraded 면 503 을 반환한다.
 * - 200: 상세 상태를 그대로 노출한다.
 * - 503: API 는 살아있지만 의존성(DB/Redis)에 문제가 있는 상태. 다만 에러 필터가
 *   개별 상세를 제거하므로 DB/Redis 는 "unknown(점검 필요)" 로 표기한다.
 * - 네트워크 오류: API 자체가 응답 불가 → api 를 down 으로 표기한다.
 *
 * 10초마다 자동 갱신하여 실시간 상태판처럼 동작한다.
 */
export const useHealthCheck = () => {
  return useQuery<SystemHealthView>({
    queryKey: ["system-health"],
    queryFn: async () => {
      const now = new Date().toISOString();
      try {
        const res = await Get<HealthStatus, undefined>("/v1/health");
        const data = res.data.data;
        if (!data) {
          return {
            status: "degraded",
            api: "up",
            db: "unknown",
            redis: "unknown",
            uptime: null,
            timestamp: now,
          };
        }
        return {
          status: data.status,
          api: "up",
          db: data.db,
          redis: data.redis,
          uptime: data.uptime,
          timestamp: data.timestamp ?? now,
        };
      } catch (error) {
        // 캐스팅 대신 타입 가드로 안전하게 좁힌다. (error 는 항상 unknown)
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        // 응답이 있으면(예: 503) API 는 살아있고 의존성이 문제인 상태다.
        const apiReachable = typeof status === "number";
        return {
          status: "degraded",
          api: apiReachable ? "up" : "down",
          db: apiReachable ? "unknown" : "down",
          redis: apiReachable ? "unknown" : "down",
          uptime: null,
          timestamp: now,
        };
      }
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
};
