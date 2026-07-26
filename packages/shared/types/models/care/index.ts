import {
  Attendance as AttendanceModel,
  DailyReport as DailyReportModel,
  ReportContent as ReportContentModel,
} from "@pawlog/database";
import { AsCreateRequest, AsUpdateRequest } from "../";

export type Attendance = AttendanceModel;
export type AttendanceCreateInput = AsCreateRequest<Attendance>;
export type AttendanceUpdateInput = AsUpdateRequest<Attendance>;

export type DailyReport = DailyReportModel;
export type DailyReportCreateInput = AsCreateRequest<DailyReport>;
export type DailyReportUpdateInput = AsUpdateRequest<DailyReport>;

export type ReportContent = ReportContentModel;
export type ReportContentCreateInput = AsCreateRequest<ReportContent>;
export type ReportContentUpdateInput = AsUpdateRequest<ReportContent>;
