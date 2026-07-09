/**
 * 시스템 헬스체크 도메인 타입 (entity model).
 * API `/v1/health` 응답(HealthService.HealthStatus)과 형태를 맞춘다.
 */
export type ServiceState = "up" | "down";

export interface HealthStatus {
  status: "ok" | "degraded";
  db: ServiceState;
  redis: ServiceState;
  uptime: number;
  timestamp: string;
}

/** 개별 서비스 행 표시용 상태. unknown = API 가 상세를 노출하지 않는 경우(예: 503). */
export type ServiceHealth = "up" | "down" | "unknown";
