/** 약관 구분 코드 ↔ 라벨 (등록 폼 선택지 및 표시에 공용) */
export const TERMS_TYPE_OPTIONS = [
  { value: "SERVICE_USE", label: "서비스 이용약관" },
  { value: "PRIVACY_POLICY", label: "개인정보 수집 및 이용 동의" },
  { value: "MARKETING_RECEIPT", label: "마케팅 정보 수신 동의" },
] as const;

export const typeLabelMap: Record<string, string> = Object.fromEntries(
  TERMS_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export const categoryBadgeStyle = (type: string): string => {
  switch (type) {
    case "SERVICE_USE":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "PRIVACY_POLICY":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "MARKETING_RECEIPT":
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
};
