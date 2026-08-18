import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { prisma, requireTenantId, tenantTransaction } from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import { solapiTemplates } from "../../shared/configs/solapi.config";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPE,
} from "../constants";
import { SolapiClientService } from "./solapi-client.service";

type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

interface DispatchParams {
  type: NotificationType;
  // job-040: 미가입 보호자에게도 발송하므로 계정이 없을 수 있다.
  // 실제 수신처는 언제나 `to`(전화번호)이고 userId 는 로그의 부가 정보다.
  userId: string | null;
  petId?: string;
  attendanceId?: string;
  dailyReportId?: string;
  to: string;
  templateId: string;
  variables?: Record<string, string>;
  smsText: string;
}

// job-040: 링크는 이제 전부 호출부가 만들어 넘긴다(reportUrl / feedUrl).
// 알림장 링크가 로그인 없이 열리는 서명 토큰 URL 이 되면서, 그 토큰을 만드는
// ReportShareService(CareModule)를 여기서 부르면 순환 의존이 되기 때문이다.

const formatTime = (date: Date) =>
  date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

const formatDate = (date: Date) =>
  date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

/**
 * 알림(카카오 알림톡/SMS) 발송 서비스.
 * 알림톡 발송을 우선 시도하고, 실패(미설정 포함) 시 SMS 로 폴백하며,
 * 발송 시도 결과는 성공/실패 여부와 관계없이 항상 NotificationLog 에 기록한다.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly solapiClient: SolapiClientService) {}

  /**
   * 실제 발송 + 이력 기록. 돌려주는 값은 **발송이 실제로 나갔는지**다.
   *
   * 대부분의 호출부는 이 값을 무시한다(보내고 잊는다). 다만 원장 화면에 "N명에게
   * 안내를 보냈습니다"처럼 **수를 말하는** 자리는 이 값을 세야 한다 — 알림톡도 SMS 도
   * 실패한 건을 세면 화면이 거짓말을 한다.
   */
  private async dispatch(params: DispatchParams): Promise<boolean> {
    let channel: string = NOTIFICATION_CHANNEL.ALIMTALK;
    let status: string = NOTIFICATION_STATUS.SUCCESS;
    let providerMessageId: string | undefined;
    let errorMessage: string | undefined;

    try {
      const result = await this.solapiClient.sendAlimtalk({
        to: params.to,
        templateId: params.templateId,
        variables: params.variables,
      });
      providerMessageId = result.messageId;
    } catch (alimtalkError) {
      this.logger.warn(
        `알림톡 발송 실패, SMS 로 폴백합니다 (type=${params.type}): ${
          (alimtalkError as Error).message
        }`,
      );
      channel = NOTIFICATION_CHANNEL.SMS;
      try {
        const result = await this.solapiClient.sendSms({
          to: params.to,
          text: params.smsText,
        });
        providerMessageId = result.messageId;
      } catch (smsError) {
        status = NOTIFICATION_STATUS.FAILED;
        errorMessage = (smsError as Error).message;
        this.logger.error(
          `SMS 폴백 발송도 실패했습니다 (type=${params.type}): ${errorMessage}`,
        );
      }
    }

    await prisma.notificationLog.create({
      data: {
        tenantId: requireTenantId(),
        userId: params.userId,
        petId: params.petId,
        attendanceId: params.attendanceId,
        dailyReportId: params.dailyReportId,
        type: params.type,
        channel,
        recipientPhone: params.to,
        templateCode:
          channel === NOTIFICATION_CHANNEL.ALIMTALK ? params.templateId : null,
        content:
          channel === NOTIFICATION_CHANNEL.ALIMTALK
            ? JSON.stringify(params.variables ?? {})
            : params.smsText,
        status,
        providerMessageId,
        errorMessage,
      },
    });

    return status === NOTIFICATION_STATUS.SUCCESS;
  }

  /** 등원 알림 */
  async notifyCheckIn(params: {
    userId: string | null;
    petId: string;
    petName: string;
    guardianPhone?: string | null;
    attendanceId: string;
    checkInAt: Date;
  }) {
    if (!params.guardianPhone) {
      this.logger.warn(
        `보호자 연락처가 없어 등원 알림을 발송하지 않습니다. petId=${params.petId}`,
      );
      return;
    }

    const time = formatTime(params.checkInAt);
    await this.dispatch({
      type: NOTIFICATION_TYPE.CHECK_IN,
      userId: params.userId,
      petId: params.petId,
      attendanceId: params.attendanceId,
      to: params.guardianPhone,
      templateId: solapiTemplates.checkIn,
      variables: { petName: params.petName, time },
      smsText: `[Pawlog] ${params.petName}(이)가 ${time}에 등원했습니다.`,
    });
  }

  /**
   * 하원 + 일일 리포트 링크 알림.
   *
   * job-040: 링크는 **호출부가 만들어 넘긴다**(feedUrl 과 같은 형태). 알림장 링크는 로그인
   * 없이 열리는 서명 토큰 URL 이고, 그 토큰을 만드는 ReportShareService 는 CareModule 에
   * 있다. 여기서 직접 부르면 Care ↔ Notification 순환 의존이 된다.
   */
  async notifyCheckOutWithReport(params: {
    userId: string | null;
    petId: string;
    petName: string;
    guardianPhone?: string | null;
    attendanceId: string;
    dailyReportId: string;
    checkOutAt: Date;
    /** SMS 폴백용 전체 URL. 문자에는 버튼이 없으므로 주소가 본문에 그대로 들어간다. */
    reportUrl: string;
    /**
     * 알림톡 버튼용 토큰.
     *
     * 알림톡은 **전체 URL 을 치환 변수로 받지 못한다** — 도메인은 템플릿 버튼에 고정으로
     * 등록하고 가변 부분만 변수가 된다(`https://<도메인>/r/#{reportToken}`). 그래서
     * 같은 링크를 채널별로 다른 모양으로 넘긴다.
     */
    reportToken: string;
  }) {
    if (!params.guardianPhone) {
      this.logger.warn(
        `보호자 연락처가 없어 하원/리포트 알림을 발송하지 않습니다. petId=${params.petId}`,
      );
      return;
    }

    const time = formatTime(params.checkOutAt);
    const { reportUrl } = params;
    await this.dispatch({
      type: NOTIFICATION_TYPE.CHECK_OUT_REPORT,
      userId: params.userId,
      petId: params.petId,
      attendanceId: params.attendanceId,
      dailyReportId: params.dailyReportId,
      to: params.guardianPhone,
      templateId: solapiTemplates.checkOutReport,
      variables: {
        petName: params.petName,
        time,
        reportToken: params.reportToken,
      },
      smsText: `[Pawlog] ${params.petName}(이)가 ${time}에 하원했습니다. 오늘의 리포트: ${reportUrl}`,
    });
  }

  /** 정기권/회수권 잔여횟수 임박 알림 */
  async notifyRemainingCountLow(params: {
    userId: string | null;
    petName?: string;
    guardianPhone?: string | null;
    remaining: number;
  }) {
    if (!params.guardianPhone) {
      this.logger.warn(
        `보호자 연락처가 없어 잔여횟수 임박 알림을 발송하지 않습니다. userId=${params.userId}`,
      );
      return;
    }

    await this.dispatch({
      type: NOTIFICATION_TYPE.REMAINING_COUNT_LOW,
      userId: params.userId,
      to: params.guardianPhone,
      templateId: solapiTemplates.remainingCountLow,
      variables: { remaining: String(params.remaining) },
      smsText: `[Pawlog] 잔여 이용 횟수가 ${params.remaining}회 남았습니다. 이용권을 갱신해주세요.`,
    });
  }

  /** 다음날 등원 예약 리마인드 알림 */
  async notifyReservationReminder(params: {
    userId: string | null;
    petId: string;
    petName: string;
    guardianPhone?: string | null;
    attendanceId: string;
    date: Date;
  }) {
    if (!params.guardianPhone) {
      this.logger.warn(
        `보호자 연락처가 없어 예약 리마인드 알림을 발송하지 않습니다. petId=${params.petId}`,
      );
      return;
    }

    const dateStr = formatDate(params.date);
    await this.dispatch({
      type: NOTIFICATION_TYPE.RESERVATION_REMINDER,
      userId: params.userId,
      petId: params.petId,
      attendanceId: params.attendanceId,
      to: params.guardianPhone,
      templateId: solapiTemplates.reservationReminder,
      variables: { petName: params.petName, date: dateStr },
      smsText: `[Pawlog] 내일(${dateStr}) ${params.petName} 등원이 예정되어 있습니다.`,
    });
  }

  /**
   * 피드에 오늘 첫 사진이 올라왔음을 알린다 (job-034).
   *
   * **아이 1마리당 하루 1건**이다. 선생님은 하루에 사진을 10~15장 올리므로 게시물마다 보내면
   * 보호자에게는 알림 폭탄이고 우리에겐 건당 원가(알림톡 8~9원)가 그대로 곱해진다. 요금에 녹일 수
   * 있는 수준(원생 30마리 × 주 3회 ≈ 월 3천원)은 "등원한 날 1건"이라는 전제에서 나온 숫자다.
   * 중복 발송 차단은 호출부(FeedNotificationService)가 NotificationLog 를 보고 판단한다.
   */
  async notifyFeedPost(params: {
    userId: string | null;
    petId: string;
    petName: string;
    guardianPhone?: string | null;
    feedUrl: string;
  }) {
    if (!params.guardianPhone) {
      this.logger.warn(
        `보호자 연락처가 없어 피드 알림을 발송하지 않습니다. petId=${params.petId}`,
      );
      return;
    }

    await this.dispatch({
      type: NOTIFICATION_TYPE.FEED_POST,
      userId: params.userId,
      petId: params.petId,
      to: params.guardianPhone,
      templateId: solapiTemplates.feedPost,
      // 사진 링크는 `${webUrl()}/feed` 로 **고정**이라 치환할 것이 없다. 알림톡 버튼에
      // 그 주소를 그대로 등록한다. (SMS 폴백만 본문에 주소를 싣는다)
      variables: { petName: params.petName },
      smsText: `[Pawlog] ${params.petName}의 오늘 사진이 올라왔어요. ${params.feedUrl}`,
    });
  }

  /**
   * 매장 임시 휴무로 그 날 등원이 취소됐음을 알린다 (job-060).
   *
   * 이 알림이 없으면 보호자는 **문 닫은 매장 앞에 아이를 데리고 선다.** 예약을 지우는
   * 것은 서버가 하지만 그 사실은 보호자 화면을 다시 열어야만 보이고, 다시 열 이유가
   * 없는 사람은 끝까지 모른다 — 취소를 통보하지 않는 취소는 취소가 아니다.
   *
   * ⚠️ 발송 실패가 휴무 등록을 되돌리면 안 된다. 매장이 쉬는 것은 이미 정해진 사실이고,
   * 알림은 그 사실을 전하는 부수 효과다. 그래서 호출부가 트랜잭션 **밖에서** 부른다.
   */
  async notifyTenantClosure(params: {
    userId: string | null;
    petId: string;
    petName: string;
    guardianPhone?: string | null;
    tenantName: string;
    date: Date;
    /** 없으면 문구에서 사유 문장을 통째로 뺀다 — "사유: 없음"은 아무것도 알려주지 않는다. */
    reason?: string | null;
  }): Promise<boolean> {
    if (!params.guardianPhone) {
      this.logger.warn(
        `보호자 연락처가 없어 휴무 알림을 발송하지 않습니다. petId=${params.petId}`,
      );
      return false;
    }

    const dateStr = formatDate(params.date);
    // 알림톡 치환 변수는 빈 문자열을 허용하지 않는 경우가 많아 고정 문구로 대체한다.
    // 사유가 비어도 템플릿의 문장 구조가 깨지지 않게 하려는 것이다.
    const reason = params.reason?.trim() || "매장 사정";

    return this.dispatch({
      type: NOTIFICATION_TYPE.TENANT_CLOSURE,
      userId: params.userId,
      petId: params.petId,
      to: params.guardianPhone,
      templateId: solapiTemplates.tenantClosure,
      variables: {
        petName: params.petName,
        tenantName: params.tenantName,
        date: dateStr,
        reason,
      },
      smsText: `[Pawlog] ${params.tenantName}이(가) ${dateStr}에 휴무하여 ${params.petName}의 등원이 취소되었습니다. (사유: ${reason}) 다른 날로 다시 예약해주세요.`,
    });
  }

  /** 오늘 이 펫으로 이미 나간 알림이 있는지 (하루 1건 제한 판정용) */
  async hasSentToday(params: { petId: string; type: string; date: Date }) {
    const nextDay = new Date(params.date);
    nextDay.setDate(nextDay.getDate() + 1);

    const existing = await prisma.notificationLog.findFirst({
      where: {
        petId: params.petId,
        type: params.type,
        status: NOTIFICATION_STATUS.SUCCESS,
        createdAt: { gte: params.date, lt: nextDay },
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  /** 발송 내역 목록 (userId/petId/type/status 필터 + 페이지네이션) */
  async findAll(
    query: PaginationQuery & {
      userId?: string;
      petId?: string;
      type?: string;
      status?: string;
    },
  ) {
    const { page, pageSize, skip, take, order } = resolvePagination(query);

    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.petId ? { petId: query.petId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.notificationLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: order },
      });
      const total = await tx.notificationLog.count({ where });
      return [items, total] as const;
    });

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 발송 내역 상세 조회 */
  async findOne(id: string) {
    const notificationLog = await prisma.notificationLog.findUnique({
      where: { id },
    });
    if (!notificationLog) {
      throw new NotFoundException("존재하지 않는 알림 발송 내역입니다.");
    }
    return { notificationLog };
  }
}
