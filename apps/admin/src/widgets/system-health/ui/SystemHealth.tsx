"use client";

import { Database, Server, Activity, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@pawlog/ui";

import { useHealthCheck } from "@/features/system/check-health";
import { ServiceStatusBadge } from "@/entities/system";
import type { ServiceHealth } from "@/entities/system";

/** 초 단위 업타임을 사람이 읽기 좋은 문자열로 변환한다. */
const formatUptime = (seconds: number | null) => {
  if (seconds === null) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}일`, h && `${h}시간`, `${m}분`].filter(Boolean).join(" ");
};

/**
 * 시스템 서비스 헬스 상태판 (widget).
 * 자체적으로 헬스체크 쿼리를 소유하고(useHealthCheck), 서비스별 상태를
 * entity 뱃지로 렌더한다. 10초마다 자동 갱신된다.
 */
export const SystemHealth = () => {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } =
    useHealthCheck();

  const services: { name: string; icon: typeof Server; state: ServiceHealth }[] =
    [
      { name: "API 서버", icon: Server, state: data?.api ?? "unknown" },
      { name: "데이터베이스", icon: Database, state: data?.db ?? "unknown" },
      { name: "Redis", icon: Activity, state: data?.redis ?? "unknown" },
    ];

  const overallOk = data?.status === "ok";

  return (
    <Card className='border-slate-800 bg-slate-900/50 text-slate-100 backdrop-blur-sm'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <div className='flex items-center gap-3'>
          <CardTitle className='text-base font-semibold text-white'>
            서비스 상태
          </CardTitle>
          {!isLoading && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                overallOk ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  overallOk ? "bg-emerald-400" : "bg-amber-400"
                } ${isFetching ? "animate-pulse" : ""}`}
              />
              {overallOk ? "정상 운영중" : "점검 필요"}
            </span>
          )}
        </div>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => refetch()}
          disabled={isFetching}
          className='text-slate-400 hover:text-white'
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </CardHeader>

      <CardContent className='space-y-3'>
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <div
              key={service.name}
              className='flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3'
            >
              <div className='flex items-center gap-3'>
                <div className='p-2 rounded-lg bg-slate-800/60 text-slate-300'>
                  <Icon className='w-4 h-4' />
                </div>
                <span className='text-sm font-medium text-slate-200'>
                  {service.name}
                </span>
              </div>
              {isLoading ? (
                <span className='text-xs text-slate-500'>확인 중…</span>
              ) : (
                <ServiceStatusBadge state={service.state} />
              )}
            </div>
          );
        })}

        <div className='flex items-center justify-between pt-2 text-xs text-slate-500'>
          <span>업타임: {formatUptime(data?.uptime ?? null)}</span>
          {dataUpdatedAt > 0 && (
            <span>
              마지막 확인: {new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
