import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

import { tossAuthHeader, tossConfig } from "../../shared/configs/toss.config";

export interface TossBillingKeyResponse {
  billingKey: string;
  card?: {
    name?: string;
    number?: string;
  };
}

export interface TossPaymentResponse {
  paymentKey: string;
  method?: string;
  approvedAt: string;
}

export interface TossErrorResponse {
  code?: string;
  message?: string;
}

/**
 * 토스페이먼츠 API 호출 공통 클라이언트 (job-034).
 *
 * 원생 이용권(SubscriptionService)과 매장 개설권(PlatformSubscriptionService)이 같은 결제
 * 게이트웨이를 쓰므로 호출 헬퍼를 여기로 모았다.
 *
 * TOSS_SECRET_KEY 가 없으면 503 을 던진다 — dev/test 는 키가 없어 결제 경로를 탈 수 없고,
 * 결제와 무관한 로직(개설권 소비, 게이팅 등)은 이 경로를 거치지 않도록 설계되어 있다.
 */
@Injectable()
export class TossClientService {
  private readonly logger = new Logger(TossClientService.name);

  get isConfigured(): boolean {
    return tossConfig.isConfigured;
  }

  async request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    if (!tossConfig.isConfigured) {
      throw new ServiceUnavailableException(
        "결제 설정이 되어있지 않습니다. (TOSS_SECRET_KEY 미설정)",
      );
    }

    let res: Response;
    try {
      res = await fetch(`${tossConfig.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: tossAuthHeader(),
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      this.logger.error(`토스 API 통신 실패: ${path}`, e as Error);
      throw new ServiceUnavailableException(
        "결제 서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    }

    const data = (await res.json().catch(() => ({}))) as TossErrorResponse & T;
    if (!res.ok) {
      this.logger.warn(
        `토스 API 오류 ${res.status}: ${data?.code} ${data?.message}`,
      );
      throw new BadRequestException(
        data?.message || "결제 처리 중 오류가 발생했습니다.",
      );
    }
    return data as T;
  }
}
