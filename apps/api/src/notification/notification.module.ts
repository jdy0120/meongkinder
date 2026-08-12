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
  exports: [NotificationService],
})
export class NotificationModule {}
