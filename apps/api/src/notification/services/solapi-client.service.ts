import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  solapiAuthHeader,
  solapiConfig,
} from "../../shared/configs/solapi.config";

interface SolapiSendResult {
  messageId: string;
}

/** 솔라피(Solapi) 메시지 발송 API 저수준 클라이언트 (카카오 알림톡 / SMS) */
@Injectable()
export class SolapiClientService {
  private readonly logger = new Logger(SolapiClientService.name);

  private async send(
    message: Record<string, unknown>,
  ): Promise<SolapiSendResult> {
    if (!solapiConfig.isConfigured) {
      throw new ServiceUnavailableException(
        "알림 발송 설정이 되어있지 않습니다. (SOLAPI_API_KEY 등 미설정)",
      );
    }

    let res: Response;
    try {
      res = await fetch(`${solapiConfig.baseUrl}/messages/v4/send`, {
        method: "POST",
        headers: {
          Authorization: solapiAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
    } catch (e) {
      this.logger.error("솔라피 API 통신 실패", e as Error);
      throw new ServiceUnavailableException("알림 서버와 통신하지 못했습니다.");
    }

    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }

    if (!res.ok) {
      const message =
        (data.errorMessage as string | undefined) ??
        (data.message as string | undefined) ??
        "알림 발송에 실패했습니다.";
      this.logger.warn(`솔라피 API 오류 ${res.status}: ${message}`);
      throw new BadRequestException(message);
    }

    const messageId =
      (data.messageId as string | undefined) ??
      (data.groupId as string | undefined) ??
      "";
    return { messageId };
  }

  /** 카카오 알림톡 발송 */
  async sendAlimtalk(params: {
    to: string;
    templateId: string;
    variables?: Record<string, string>;
  }): Promise<SolapiSendResult> {
    if (!solapiConfig.isKakaoConfigured) {
      throw new ServiceUnavailableException(
        "카카오 알림톡 설정이 되어있지 않습니다. (SOLAPI_KAKAO_PF_ID 미설정)",
      );
    }

    return this.send({
      to: params.to,
      from: solapiConfig.senderPhone,
      type: "ATA",
      kakaoOptions: {
        pfId: solapiConfig.kakaoPfId,
        templateId: params.templateId,
        variables: params.variables ?? {},
        // 알림톡 전용 시도만 한다. 실패 시 SMS 재발송·로깅은 상위(NotificationService)가 담당한다.
        disableSms: true,
      },
    });
  }

  /** SMS 발송 (알림톡 폴백 또는 단독 발송) */
  async sendSms(params: {
    to: string;
    text: string;
  }): Promise<SolapiSendResult> {
    return this.send({
      to: params.to,
      from: solapiConfig.senderPhone,
      text: params.text,
      type: "SMS",
    });
  }
}
