import type { DailyReport, ReportContent } from "@pawlog/database";

/**
 * v1/daily-reports 응답에 포함되는 항목(contents) 확장 타입.
 * 서비스가 Prisma `include: { contents: true }` 로 함께 내려주지만
 * `@pawlog/shared` 계약에는 별도 타입이 정의되어 있지 않아 admin 앱에서 로컬로 확장한다.
 */
export interface DailyReportWithContents extends DailyReport {
  contents: ReportContent[];
}
