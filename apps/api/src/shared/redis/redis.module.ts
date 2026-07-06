import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";

// 전역 모듈 — 어느 모듈에서든 RedisService 를 주입해 사용할 수 있습니다.
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
