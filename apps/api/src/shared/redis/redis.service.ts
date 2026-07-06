import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import { redisConfig } from "../configs/redis.config";

/**
 * Redis 클라이언트 래퍼.
 * 토큰/세션 등 짧은 TTL 데이터를 빠르게 읽고 쓰기 위한 얇은 헬퍼입니다.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      // 명령 재시도 무한 대기 방지
      maxRetriesPerRequest: 3,
    });

    this.client.on("connect", () => {
      this.logger.log(
        `✅ Redis 연결 성공 (${redisConfig.host}:${redisConfig.port})`,
      );
    });
    this.client.on("error", (err) => {
      this.logger.error(`❌ Redis 오류: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  /** 값 저장. ttlSec 지정 시 해당 초 뒤 자동 만료 */
  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    if (ttlSec) {
      await this.client.set(key, value, "EX", ttlSec);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** 원시 클라이언트 접근 (고급 명령이 필요할 때) */
  get raw(): Redis {
    return this.client;
  }
}
