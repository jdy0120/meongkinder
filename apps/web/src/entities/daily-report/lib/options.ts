/**
 * 표시 헬퍼가 필요로 하는 최소 형태 (job-040).
 *
 * 예전에는 Prisma `ReportContent` 를 그대로 받았는데, 공개 알림장(로그인 없이 열리는
 * 알림톡 링크)은 응답에 담는 필드를 의도적으로 줄여서 내려주므로 그 타입이 맞지 않는다.
 * 화면이 실제로 쓰는 칸만 요구하도록 낮추면 두 응답 모두 같은 헬퍼를 쓸 수 있다.
 */
export interface ReportContentLike {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  fileId: string | null;
  order: number;
}

/** 리포트 항목 구분 코드 ↔ 라벨 (컨디션 요약 표시에 공용) */
export const reportContentTypeLabelMap: Record<string, string> = {
  MEAL: "식사",
  TOILET: "배변",
  NAP: "낮잠",
  ACTIVITY: "활동",
  HEALTH: "건강",
  NOTE: "특이사항",
  PHOTO: "사진",
};

/** 컨디션 요약에 노출할 항목 구분 순서 (사진/특이사항 제외 — 별도 섹션에서 표시) */
const CONDITION_SUMMARY_ORDER = ["MEAL", "TOILET", "NAP", "ACTIVITY", "HEALTH"];

export interface ConditionSummaryItem {
  type: string;
  label: string;
  contents: ReportContentLike[];
}

/** 리포트 항목들을 식사/배변/낮잠/활동/건강 순으로 그룹핑해 컨디션 요약 카드에 표시할 형태로 변환 */
export const groupContentsForConditionSummary = (
  contents: ReportContentLike[],
): ConditionSummaryItem[] =>
  CONDITION_SUMMARY_ORDER.map((type) => ({
    type,
    label: reportContentTypeLabelMap[type],
    contents: contents
      .filter((content) => content.type === type)
      .sort((a, b) => a.order - b.order),
  })).filter((group) => group.contents.length > 0);

/** 특이사항(NOTE) 항목만 추출 */
export const getNoteContents = (contents: ReportContentLike[]): ReportContentLike[] =>
  contents.filter((content) => content.type === "NOTE");

/** 사진(PHOTO) 항목만 order 순으로 추출 */
export const getPhotoContents = (contents: ReportContentLike[]): ReportContentLike[] =>
  contents
    .filter((content) => content.type === "PHOTO" && content.fileId)
    .sort((a, b) => a.order - b.order);

// job-038: admin 에서 이관된 매장 운영(리포트 작성)용 옵션
export const REPORT_CONTENT_TYPE_OPTIONS = [
  { value: "MEAL", label: "식사" },
  { value: "TOILET", label: "배변" },
  { value: "NAP", label: "낮잠" },
  { value: "ACTIVITY", label: "활동" },
  { value: "NOTE", label: "특이사항" },
] as const;

export const QUICK_PHRASES_BY_TYPE: Record<string, string[]> = {
  MEAL: ["잘 먹음", "보통", "적게 먹음", "먹지 않음"],
  TOILET: ["소변", "대변", "정상", "묽음"],
  NAP: ["잘 잠", "뒤척임", "짧게 잠", "안 잠"],
  ACTIVITY: ["활발함", "차분함", "친구와 잘 놂", "혼자 놂"],
  NOTE: ["특이사항 없음", "주의 관찰 필요", "보호자 확인 요망"],
};

export const DAILY_REPORT_STATUS_OPTIONS = [
  { value: "DRAFT", label: "임시저장" },
  { value: "PUBLISHED", label: "발행" },
] as const;

export const dailyReportStatusLabelMap: Record<string, string> =
  Object.fromEntries(
    DAILY_REPORT_STATUS_OPTIONS.map((option) => [option.value, option.label]),
  );

