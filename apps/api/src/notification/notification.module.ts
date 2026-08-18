import { Module } from "@nestjs/common";
import { NotificationLogController } from "./controllers/notification-log.controller";
import { NotificationReminderSchedulerService } from "./services/notification-reminder-scheduler.service";
import { NotificationService } from "./services/notification.service";
import { SolapiClientService } from "./services/solapi-client.service";

@Module({
  controllers: [NotificationLogController],
  providers: [
    NotificationService,
    SolapiClientService,
    NotificationReminderSchedulerService,
  ],
  // job-042: AuthModule 의 PhoneOtpService 가 본인확인 문자를 직접 보낸다.
  // NotificationService 를 거치지 않는 이유는 그쪽이 **보호자에게 가는 알림**을 다루고
  // NotificationLog(tenantId 필수)에 기록하기 때문 — 인증 문자는 매장과 무관하다.
  exports: [NotificationService, SolapiClientService],
})
export class NotificationModule {}
