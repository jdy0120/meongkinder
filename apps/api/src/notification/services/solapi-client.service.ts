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

  /**
   * 치환 변수 키를 **두 형태로 함께** 실어 보낸다.
   *
   * 카카오 템플릿 본문에는 `#{petName}` 으로 쓰는데, Solapi API 로 넘기는 `variables`
   * 객체의 **키**가 `#{petName}` 인지 `petName` 인지는 문서/버전에 따라 갈린다. 어느
   * 한쪽만 보내면 어긋났을 때 **본문에 `#{petName}` 이 그대로 찍힌 채 발송된다** —
   * 심사를 통과한 템플릿이 실사용에서 조용히 망가지는 형태다.
   *
   * 둘 다 넣으면 맞는 쪽이 치환되고 나머지는 무시된다. 페이로드가 조금 커지는 대신
   * "첫 발송에서 확인하고 고친다"는 왕복이 사라진다.
   */
  private expandVariableKeys(
    variables: Record<string, string> = {},
  ): Record<string, string> {
    const expanded: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
      const bare = key.replace(/^#\{|\}$/g, "");
      expanded[bare] = value;
      expanded[`#{${bare}}`] = value;
    }
    return expanded;
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
        variables: this.expandVariableKeys(params.variables),
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
