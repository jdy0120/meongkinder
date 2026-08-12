import { DailyReportForm } from "./ui/DailyReportForm";

interface EditDailyReportPageProps {
  reportId: string;
}

/** 일일 리포트 수정 페이지 (view). */
export const EditDailyReportPage = ({ reportId }: EditDailyReportPageProps) => (
  <DailyReportForm mode='edit' reportId={reportId} />
);
