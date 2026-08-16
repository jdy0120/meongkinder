/** 약관 구분 코드 ↔ 라벨 (등록 폼 선택지 및 표시에 공용) */
export const TERMS_TYPE_OPTIONS = [
  { value: "SERVICE_USE", label: "서비스 이용약관" },
  { value: "PRIVACY_POLICY", label: "개인정보 수집 및 이용 동의" },
  { value: "MARKETING_RECEIPT", label: "마케팅 정보 수신 동의" },
] as const;

export const typeLabelMap: Record<string, string> = Object.fromEntries(
  TERMS_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * 약관 구분 뱃지 스타일.
 *
 * ⚠️ **구분마다 다른 색을 주지 않는다.** 예전에는 blue/emerald/purple 을 하나씩 배정했는데,
 * 약관 종류는 긴급도가 아니라 **분류**다. 분류에 색을 쓰면 색이 "지금 봐야 할 것"을 말할
 * 수 없게 되고(같은 표 안에서 활성/필수 여부가 진짜 신호다), 팔레트 밖 색이 화면마다
 * 늘어난다. 무엇인지는 라벨이 이미 온전히 말하고 있다.
 *
 * 개인정보 관련 약관만 한 단계 강조한다 — 운영자가 잘못 비활성화하면 즉시 법적 문제가
 * 되는 유일한 항목이라, 여기서는 색이 실제로 긴급도를 뜻한다.
 */
export const categoryBadgeStyle = (type: string): string => {
  switch (type) {
    case "PRIVACY_POLICY":
      return "bg-caution-tint text-caution-text";
    default:
      return "bg-secondary text-text-muted";
  }
};
