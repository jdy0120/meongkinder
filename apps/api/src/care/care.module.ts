import { Module } from "@nestjs/common";
import { AttendanceController } from "./controllers/attendance.controller";
import { DailyReportController } from "./controllers/daily-report.controller";
import { ReportContentController } from "./controllers/report-content.controller";
import { AttendanceService } from "./services/attendance.service";
import { DailyReportService } from "./services/daily-report.service";
import { ReportContentService } from "./services/report-content.service";

@Module({
  controllers: [
    AttendanceController,
    DailyReportController,
    ReportContentController,
  ],
  providers: [AttendanceService, DailyReportService, ReportContentService],
  exports: [AttendanceService, DailyReportService, ReportContentService],
})
export class CareModule {}
