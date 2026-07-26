import type { Attendance, DailyReport, ReportContent } from "@pawlog/database";

export interface CreateAttendanceRequest {
  petId: string;
  date: string; // ISO 8601
  status?: string;
}

export type UpdateAttendanceRequest = Partial<
  Omit<CreateAttendanceRequest, "petId">
> & {
  checkInAt?: string; // ISO 8601
  checkOutAt?: string; // ISO 8601
};

export interface AttendanceResponse {
  attendance: Attendance;
}

export interface CreateDailyReportRequest {
  petId: string;
  attendanceId?: string;
  date: string; // ISO 8601
  summary?: string;
  status?: string;
}

export type UpdateDailyReportRequest = Partial<
  Omit<CreateDailyReportRequest, "petId">
>;

export interface DailyReportResponse {
  dailyReport: DailyReport;
}

export interface CreateReportContentRequest {
  type: string; // MEAL | ACTIVITY | HEALTH | NOTE | PHOTO
  title?: string;
  content?: string;
  fileId?: string;
  order?: number;
}

export type UpdateReportContentRequest = Partial<CreateReportContentRequest>;

export interface ReportContentResponse {
  reportContent: ReportContent;
}
