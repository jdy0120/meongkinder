"use client";

import { Database, Server, Activity, RefreshCw } from "lucide-react";
import { Button } from "@pawlog/ui";

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
    <section className='flex flex-col gap-5 rounded-2xl p-5 neu-raised'>
      <div className='flex items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <h2 className='text-card text-foreground'>서비스 상태</h2>
          {!isLoading && (
            <span
              className={`inline-flex items-center gap-1.5 text-body-sm font-semibold ${
                overallOk ? "text-success-text" : "text-caution-text"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  overallOk ? "bg-success-text" : "bg-caution-text"
                } ${isFetching ? "animate-pulse" : ""}`}
              />
              {overallOk ? "정상 운영중" : "점검 필요"}
            </span>
          )}
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => refetch()}
          disabled={isFetching}
          className='cursor-pointer gap-1.5 border-transparent bg-transparent px-4 text-text-muted neu-press'
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      <div className='flex flex-col gap-3'>
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <div
              key={service.name}
              className='flex items-center justify-between rounded-xl px-4 py-3.5 neu-inset'
            >
              <div className='flex items-center gap-3'>
                <div className='flex size-9 items-center justify-center rounded-xl bg-muted text-text-muted'>
                  <Icon className='size-4' />
                </div>
                <span className='text-body-sm font-semibold text-foreground'>
                  {service.name}
                </span>
              </div>
              {isLoading ? (
                <span className='text-meta text-text-meta'>확인 중…</span>
              ) : (
                <ServiceStatusBadge state={service.state} />
              )}
            </div>
          );
        })}
      </div>

      <div className='flex items-center justify-between text-meta text-text-meta'>
        <span>업타임: {formatUptime(data?.uptime ?? null)}</span>
        {dataUpdatedAt > 0 && (
          <span>
            마지막 확인: {new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")}
          </span>
        )}
      </div>
    </section>
  );
};
