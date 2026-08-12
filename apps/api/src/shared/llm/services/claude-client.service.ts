import Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";
import { anthropicConfig } from "../../configs/anthropic.config";

export interface CompleteParams {
  /** 역할·문체·금지사항 등 요청마다 바뀌지 않는 지시 */
  system: string;
  /** 이번 건의 재료 (그 아이의 오늘 캡션·친구·사진 수 등) */
  prompt: string;
  maxTokens?: number;
}

/**
 * Claude API 저수준 클라이언트 (solapi-client.service 와 같은 자리의 얇은 래퍼).
 *
 * **호출 실패를 예외로 올리지 않고 null 을 돌려준다.** 이 API 를 쓰는 곳(알림장 요약)은
 * 실패 시 규칙 기반 문장으로 폴백해야 하는데, 예외를 던지면 호출부마다 try/catch 를 두거나
 * 최악의 경우 하루 마감 전체가 실패한다. "모델이 답을 못 줬다"는 정상적으로 일어나는 일이지
 * 마감을 막을 사건이 아니다.
 */
@Injectable()
export class ClaudeClientService {
  private readonly logger = new Logger(ClaudeClientService.name);
  private client: Anthropic | null = null;

  get isConfigured() {
    return anthropicConfig.isConfigured;
  }

  private getClient(): Anthropic | null {
    if (!anthropicConfig.isConfigured) return null;
    // 지연 생성 — 키가 없는 환경(로컬·CI)에서 부팅만으로 클라이언트를 만들지 않는다.
    this.client ??= new Anthropic({ apiKey: anthropicConfig.apiKey });
    return this.client;
  }

  /** 텍스트 한 덩어리를 생성한다. 실패하거나 미설정이면 null. */
  async complete(params: CompleteParams): Promise<string | null> {
    const client = this.getClient();
    if (!client) {
      this.logger.debug(
        "ANTHROPIC_API_KEY 가 없어 LLM 호출을 건너뜁니다 (규칙 기반으로 폴백).",
      );
      return null;
    }

    try {
      const message = await client.messages.create({
        model: anthropicConfig.model,
        max_tokens: params.maxTokens ?? 1024,
        system: params.system,
        messages: [{ role: "user", content: params.prompt }],
      });

      // 안전 분류기가 요청을 거절하면 content 가 비어 있다. 예외가 아니라 정상 200 이므로
      // stop_reason 을 먼저 보고 content[0] 을 건드리지 않는다.
      if (message.stop_reason === "refusal") {
        this.logger.warn(
          `모델이 응답을 거절했습니다 (category=${message.stop_details?.category ?? "unknown"}).`,
        );
        return null;
      }

      const text = message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();

      return text || null;
    } catch (error) {
      this.logger.warn(
        `Claude API 호출 실패, 규칙 기반 문장으로 폴백합니다: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 여러 건을 동시성 상한을 두고 처리한다.
   * 하루 마감은 원생 수만큼 호출이 생기므로(30마리 = 30콜) 한꺼번에 쏘면 rate limit 에 걸린다.
   */
  async mapWithLimit<T, R>(
    items: T[],
    worker: (item: T) => Promise<R>,
    limit = anthropicConfig.concurrency,
  ): Promise<R[]> {
    const results: R[] = Array.from({ length: items.length });
    let cursor = 0;

    const runners = Array.from(
      { length: Math.max(1, Math.min(limit, items.length)) },
      async () => {
        while (cursor < items.length) {
          const index = cursor++;
          results[index] = await worker(items[index]);
        }
      },
    );

    await Promise.all(runners);
    return results;
  }
}
