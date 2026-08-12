import { Global, Module } from "@nestjs/common";
import { ClaudeClientService } from "./services/claude-client.service";

/**
 * LLM 클라이언트 모듈.
 * 알림장 요약·캡션 등 여러 도메인이 쓰게 되므로 @Global 로 열어 둔다 (RedisModule 과 같은 자리).
 */
@Global()
@Module({
  providers: [ClaudeClientService],
  exports: [ClaudeClientService],
})
export class LlmModule {}
