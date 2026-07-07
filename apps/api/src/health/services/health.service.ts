import { Injectable } from "@nestjs/common";
import { prisma } from "@template/database";

import { RedisService } from "../../shared/redis/redis.service";

export interface HealthStatus {
  status: "ok" | "degraded";
  db: "up" | "down";
  redis: "up" | "down";
  uptime: number;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly redis: RedisService) {}

  /** DB·Redis 연결 상태를 점검한다 (로드밸런서/모니터링용). */
  async check(): Promise<HealthStatus> {
    const [db, redisUp] = await Promise.all([this.pingDb(), this.pingRedis()]);

    return {
      status: db && redisUp ? "ok" : "degraded",
      db: db ? "up" : "down",
      redis: redisUp ? "up" : "down",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async pingDb(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      return (await this.redis.raw.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}
