export type { DailyReportWithPetAndContents } from "@pawlog/shared";
export type { DailyReportWithContents } from "./model/types";
export type { ConditionSummaryItem, ReportContentLike } from "./lib/options";

export {
  reportContentTypeLabelMap,
  groupContentsForConditionSummary,
  getNoteContents,
  getPhotoContents,
  // job-038: admin 에서 이관된 매장 운영(리포트 작성)용 옵션
  REPORT_CONTENT_TYPE_OPTIONS,
  QUICK_PHRASES_BY_TYPE,
  DAILY_REPORT_STATUS_OPTIONS,
  dailyReportStatusLabelMap,
} from "./lib/options";

// 보호자용 (리포트 열람)
export { ConditionSummary } from "./ui/ConditionSummary";
export { ReportPhotoTile } from "./ui/ReportPhotoTile";
export { ReportCard } from "./ui/ReportCard";
export { useMyDailyReport } from "./model/useMyDailyReport";
// 미가입 보호자용 (알림톡 링크로 여는 공개 알림장)
export { useSharedDailyReport } from "./model/useSharedDailyReport";

// 매장 운영용 (리포트 작성·관리)
export { DailyReportStatusBadge } from "./ui/DailyReportStatusBadge";
export { useDailyReport } from "./model/useDailyReport";
