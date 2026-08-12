import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@pawlog/database";
import { NotificationService } from "../../notification/services/notification.service";
import { resolveGuardianPhone } from "../../shared/utils";

export type GuardianNotificationEvent =
  | "CHECK_IN"
  | "CHECK_OUT"
  | "ABSENT"
  | "MAKEUP";

export interface GuardianNotificationPayload {
  petId: string;
  attendanceId: string;
  // job-040: 아직 가입하지 않은 보호자의 아이는 계정이 없다(Pet.userId = null).
  // 알림은 계정이 아니라 전화번호로 나가므로 이 값이 없어도 발송은 정상 진행된다.
  userId: string | null;
  reason?: string;
}

/**
 * 보호자 알림 발송 내부 트리거.
 * 등원(CHECK_IN)은 즉시 알림을 발송한다. 하원(CHECK_OUT)은 아직 일일 리포트가
 * 작성되지 않았을 수 있어 여기서는 발송하지 않고, 리포트가 PUBLISHED 되는 시점에
 * DailyReportService 가 "하원+리포트 링크" 알림을 별도로 발송한다.
 * ABSENT/MAKEUP 은 현재 이벤트 로그만 남긴다.
 */
@Injectable()
export class GuardianNotificationService {
  private readonly logger = new Logger(GuardianNotificationService.name);

  constructor(private readonly notificationService: NotificationService) {}

  async trigger(
    event: GuardianNotificationEvent,
    payload: GuardianNotificationPayload,
  ) {
    this.logger.log(
      `[알림 트리거] event=${event} petId=${payload.petId} attendanceId=${payload.attendanceId} userId=${payload.userId}${
        payload.reason ? ` reason=${payload.reason}` : ""
      }`,
    );

    if (event !== "CHECK_IN") return;

    const attendance = await prisma.attendance.findUnique({
      where: { id: payload.attendanceId },
      include: {
        pet: {
          select: {
            name: true,
            guardianPhone: true,
            // 보호자가 직접 등록한 아이는 guardianPhone 이 비어 있기 쉽다(선택 입력).
            // 계정 전화번호로 폴백하지 않으면 가입한 보호자인데도 알림이 조용히 누락된다.
            user: { select: { phone: true } },
          },
        },
      },
    });
    if (!attendance?.checkInAt) return;

    await this.notificationService.notifyCheckIn({
      userId: payload.userId,
      petId: payload.petId,
      petName: attendance.pet.name,
      guardianPhone: resolveGuardianPhone(attendance.pet),
      attendanceId: payload.attendanceId,
      checkInAt: attendance.checkInAt,
    });
  }
}
