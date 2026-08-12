import { Module } from "@nestjs/common";
import { FileModule } from "../shared/file/file.module";
import { NotificationModule } from "../notification/notification.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { AttendanceController } from "./controllers/attendance.controller";
import { DailyReportController } from "./controllers/daily-report.controller";
import { ReportContentController } from "./controllers/report-content.controller";
import { AiCommentDraftService } from "./services/ai-comment-draft.service";
import { AttendanceService } from "./services/attendance.service";
import { DailyReportService } from "./services/daily-report.service";
import { GuardianNotificationService } from "./services/guardian-notification.service";
import { ReportContentService } from "./services/report-content.service";
import { ReportShareService } from "./services/report-share.service";

@Module({
  imports: [SubscriptionModule, FileModule, NotificationModule],
  controllers: [
    AttendanceController,
    DailyReportController,
    ReportContentController,
  ],
  providers: [
    AttendanceService,
    DailyReportService,
    ReportContentService,
    GuardianNotificationService,
    AiCommentDraftService,
    ReportShareService,
  ],
  // NotificationModule 이 알림톡 링크를 만들 때 ReportShareService.createToken 을 쓴다.
  exports: [
    AttendanceService,
    DailyReportService,
    ReportContentService,
    ReportShareService,
  ],
})
export class CareModule {}
