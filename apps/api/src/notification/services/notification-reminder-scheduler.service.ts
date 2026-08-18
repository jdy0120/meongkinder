import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  prisma,
  requireTenantId,
  runWithoutTenant,
  runWithTenant,
} from "@pawlog/database";
import {
  resolveGuardianPhone,
  scheduledOn,
  startOfTomorrow,
} from "../../shared/utils";
import { NotificationService } from "./notification.service";

@Injectable()
export class NotificationReminderSchedulerService {
  private readonly logger = new Logger(
    NotificationReminderSchedulerService.name,
  );

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 매일 저녁 8시(한국 시각), 내일 등원 예정(요일 스케줄)인 이용중 펫에 대해
   * 내일자 출석 기록을 SCHEDULED 로 미리 생성한 뒤 예약 리마인드 알림을 발송한다.
   * @Cron 은 요청 컨텍스트 밖이라 ALS 에 tenantId 가 없다 — 활성 테넌트를 순회하며 처리한다.
   *
   * ⚠️ `timeZone` 을 반드시 붙인다. 배포 컨테이너는 UTC 라 `EVERY_DAY_AT_8PM`(서버 로컬
   * 20:00)은 **KST 새벽 5시**에 돌았다 — 보호자가 자는 시간에 알림톡이 나갔고, 그때의
   * "내일"은 한국 달력으로는 이미 당일이라 등원 당일 새벽에 "내일 오세요"를 보낸 셈이다.
   */
  @Cron("0 20 * * *", { timeZone: "Asia/Seoul" })
  async handleReservationReminder() {
    const tenants = await runWithoutTenant(() =>
      prisma.tenant.findMany({ where: { isActive: true } }),
    );

    for (const tenant of tenants) {
      await runWithTenant(tenant.id, () =>
        this.handleReservationReminderForTenant(),
      );
    }
  }

  private async handleReservationReminderForTenant() {
    const tomorrow = startOfTomorrow();

    const scheduledPets = await prisma.pet.findMany({
      // job-053: 요일 반복 + 날짜 지정 두 방식을 함께 본다. 한쪽만 읽으면 날짜 지정
      // 아이는 출석부에는 뜨는데 보호자에게 예약 알림이 안 간다.
      where: { status: "ACTIVE", ...scheduledOn(tomorrow) },
      select: {
        id: true,
        name: true,
        userId: true,
        guardianPhone: true,
        user: { select: { phone: true } },
      },
    });

    if (scheduledPets.length === 0) return;

    const tenantId = requireTenantId();
    await prisma.attendance.createMany({
      data: scheduledPets.map(({ id: petId }) => ({
        tenantId,
        petId,
        date: tomorrow,
        status: "SCHEDULED",
      })),
      skipDuplicates: true,
    });

    const attendances = await prisma.attendance.findMany({
      where: { date: tomorrow, petId: { in: scheduledPets.map((p) => p.id) } },
      select: { id: true, petId: true },
    });
    const attendanceIdByPetId = new Map(
      attendances.map((a) => [a.petId, a.id]),
    );

    this.logger.log(
      `내일(${tomorrow.toISOString().slice(0, 10)}) 등원 예정 ${scheduledPets.length}건에 대해 예약 리마인드 알림을 발송합니다.`,
    );

    for (const pet of scheduledPets) {
      const attendanceId = attendanceIdByPetId.get(pet.id);
      if (!attendanceId) continue;

      await this.notificationService.notifyReservationReminder({
        userId: pet.userId,
        petId: pet.id,
        petName: pet.name,
        guardianPhone: resolveGuardianPhone(pet),
        attendanceId,
        date: tomorrow,
      });
    }
  }
}
