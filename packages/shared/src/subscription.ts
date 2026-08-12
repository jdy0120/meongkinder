// 정기권/회수권 상품 유형 (api·web·admin 공통)
// RECURRING(기존 정기결제/자동갱신) | COUNT(횟수제 회수권, 예: 10회권)
// | UNLIMITED(기간 내 무제한, 예: 월 무제한) | PERIOD(단기 기간제, 예: 호텔 1박권)
export const SUBSCRIPTION_PLAN_TYPES = [
  "RECURRING",
  "COUNT",
  "UNLIMITED",
  "PERIOD",
] as const;

export type SubscriptionPlanType = (typeof SUBSCRIPTION_PLAN_TYPES)[number];

/**
 * 요금제가 무엇을 파는지 (job-034).
 *
 *   TENANT   — 원생 이용권. 보호자가 특정 유치원에서 결제하는 10회권/월 무제한/호텔 1박권 등.
 *              구매 결과는 TenantSubscription.
 *   PLATFORM — 매장 개설권. 회원이 pawlog 에 직접 결제하는 SaaS 요금으로 1건당 매장 1개를
 *              개설할 수 있다. 구매 결과는 UserSubscription.
 *
 * 두 상품이 SubscriptionPlan 한 테이블에 섞여 있으므로 목록 조회 시 반드시 걸러야 한다.
 */
export const SUBSCRIPTION_PLAN_SCOPES = ["TENANT", "PLATFORM"] as const;

export type SubscriptionPlanScope = (typeof SUBSCRIPTION_PLAN_SCOPES)[number];

/**
 * 매출 결제 수단 (job-051).
 *
 * `CARD` 만 온라인 결제(토스)이고 나머지 셋은 현장 수납이다. 동네 유치원은 현금·계좌이체
 * 비중이 큰데 예전에는 현장 수납이 금액 없이 횟수로만 기록돼 매출에서 통째로 빠졌다.
 *
 * `CARD_OFFLINE`(매장 카드 단말기)을 `CARD` 와 나누는 이유: 우리 시스템에 토스 결제 기록이
 * 남는 것과 원장이 단말기로 긁고 손으로 입력한 것은 대사(對査) 방법이 다르다. 전자는
 * TenantSale.paymentId 로 PG 내역과 맞춰볼 수 있지만 후자는 그럴 근거가 없다.
 */
export const SALE_METHODS = [
  "CARD",
  "CARD_OFFLINE",
  "CASH",
  "TRANSFER",
] as const;

export type SaleMethod = (typeof SALE_METHODS)[number];

export const SALE_METHOD_LABELS: Record<SaleMethod, string> = {
  CARD: "온라인 카드",
  CARD_OFFLINE: "현장 카드",
  CASH: "현금",
  TRANSFER: "계좌이체",
};
