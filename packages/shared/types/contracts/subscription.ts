import type {
  Prisma,
  SubscriptionPlan,
  TenantSubscription,
  UserSubscription,
} from "@pawlog/database";
import type { SaleMethod, SubscriptionPlanType } from "../../src/subscription";

export interface IssueBillingKeyRequest {
  authKey: string;
  customerKey: string;
}

export interface IssueBillingKeyResponse {
  cardName: string | null;
  cardNumber: string | null;
}

export interface CreateSubscriptionRequest {
  planId: string;
}

export interface CreateSubscriptionResponse {
  subscription: TenantSubscription;
}

export interface CancelSubscriptionResponse {
  subscription: TenantSubscription;
}

export interface PauseSubscriptionResponse {
  subscription: TenantSubscription;
}

export interface ResumeSubscriptionResponse {
  subscription: TenantSubscription;
}

export interface MySubscriptionResponse {
  subscription: (TenantSubscription & { plan: SubscriptionPlan }) | null;
  billingKey: {
    cardName: string | null;
    cardNumber: string | null;
  } | null;
}

export interface CreateSubscriptionPlanRequest {
  name: string;
  price: number;
  interval: string;
  description?: string;
  planType: SubscriptionPlanType;
  totalCount?: number;
  validityDays?: number;
  isActive?: boolean;
}

export type UpdateSubscriptionPlanRequest =
  Partial<CreateSubscriptionPlanRequest>;

export interface SubscriptionPlanResponse {
  plan: SubscriptionPlan;
}

// ── 매장 개설권 (v1/platform-subscriptions) ───────────
// 원생 이용권과 달리 주체가 **회원**이고 테넌트가 생기기 전에 발급된다.

/**
 * 개설권 요금제 목록 (job-056).
 *
 * `paymentRequired=false` 면 서버가 결제 없이 개설권을 발급하는 상태다
 * (`ALLOW_UNPAID_TENANT_SEAT`). 화면은 이 값을 보고 **누르기 전에** 그 사실을 밝혀야 한다 —
 * 카드도 안 넣었는데 "구독"이 성사되면 사용자는 결제된 줄 안다.
 */
export interface SeatPlanListResponse {
  plans: SubscriptionPlan[];
  paymentRequired: boolean;
}

export interface SubscribeSeatResponse {
  subscription: UserSubscription;
  /** 결제를 거치지 않았으면 null. */
  paymentKey: string | null;
  /** 실제로 돈이 오갔는지. false 면 무료 발급이다. */
  paid: boolean;
}

/**
 * 보호자가 보는 이용권 1건 (job-055).
 *
 * `pet` 을 함께 싣는 이유: 이용권의 주인은 아이다(`TenantSubscription.petId`, job-051).
 * 형제견을 맡긴 보호자에게 "10회권 · 잔여 3회" 카드만 두 장 보여주면 어느 아이 것인지
 * 알 수 없다 — 그런데 정작 충전이 필요한 건 그중 한 마리다.
 *
 * 손으로 쓰지 않고 Prisma 에서 유도한다(CLAUDE.md §2). `petId` 가 nullable 이라
 * `pet` 도 `| null` 이 자동으로 따라붙는다 — job-051 이전에 팔린 이용권은 아이를 가리키지
 * 않으므로, 화면이 그 경우를 반드시 다뤄야 한다.
 */
export type MyTicketSubscription = Prisma.TenantSubscriptionGetPayload<{
  include: {
    plan: true;
    pet: { select: { id: true; name: true } };
  };
}>;

export interface MyTicketItem {
  subscription: MyTicketSubscription;
  // COUNT/PERIOD 유형의 잔여 횟수. UNLIMITED/RECURRING 유형은 횟수 개념이 없어 null.
  remainingCount: number | null;
}

export interface MyTicketsResponse {
  tickets: MyTicketItem[];
}

// ── 매출 (job-051) ────────────────────────────────────
// **입금 기준**이다 — 판매 시점에 전액을 그 달 매출로 잡는다. 원장이 통장을 보는 방식과 같다.
// 원장이 pawlog 에 내는 매장 개설권 비용은 여기 들어가지 않는다(그건 유치원의 비용이지 매출이 아니다).

export interface MonthlyRevenueItem {
  year: number;
  month: number;
  label: string; // "2026-08"
  total: number; // 순매출(원) = 받은 돈 − 환불액
  count: number; // 판매 건수 (전액 환불 건도 센다 — 판 적이 없던 게 아니다)
  refunded: number; // 그달 환불 총액(원)
}

export interface MonthlyRevenueResponse {
  months: MonthlyRevenueItem[];
}

// ── 날짜별 매출 (job-063) — 매출 화면의 달력 ──────────────────────────
//
// 날짜 접기를 **서버가** 한다. `RevenueSummaryResponse.sales` 의 `soldAt` 은 UTC ISO 라
// 화면에서 접으면 KST 09시 이전 판매가 전날로 붙고, 같은 화면의 월 합계와 어긋난다.

export interface DailyRevenueItem {
  /** `"YYYY-MM-DD"` (한국 달력 기준) */
  date: string;
  /** 그날 받은 돈. 환불을 빼기 전 금액이다. */
  gross: number;
  /** 그날 판매분에서 돌려준 돈. */
  refunded: number;
  /** 순매출 = `gross - refunded`. */
  total: number;
  /** 판매 건수 (전액 환불 건도 센다 — 판 적이 없던 게 아니다). */
  count: number;
}

export interface DailyRevenueResponse {
  year: number;
  month: number;
  /** 판매가 **있는 날만** 담는다. 없는 날은 화면이 빈 칸으로 그린다. */
  days: DailyRevenueItem[];
}

export interface RevenueByMethod {
  method: SaleMethod;
  total: number;
  count: number;
}

export interface RevenueByPlan {
  planId: string | null; // 요금제가 삭제되면 null (매출 기록은 남는다)
  planName: string;
  total: number;
  count: number;
}

export interface RevenueSaleItem {
  id: string;
  amount: number; // 판매 당시 받은 금액
  refundedAmount: number; // 그중 돌려준 금액 (0이면 환불 없음)
  refundReason: string | null;
  method: SaleMethod;
  soldAt: string | Date;
  memo: string | null;
  planName: string | null;
  petName: string | null;
}

export interface RevenueSummaryResponse {
  year: number;
  month: number;
  total: number; // 순매출
  count: number;
  refunded: number; // 총 환불액 — 매출이 준 이유가 판매 부진인지 환불인지 가른다
  byMethod: RevenueByMethod[];
  byPlan: RevenueByPlan[];
  sales: RevenueSaleItem[];
}

/** 현장 판매 요청 — 요금제를 골라 대면 결제로 이용권을 개통한다. */
export interface SellTicketRequest {
  petId: string;
  planId: string;
  method: SaleMethod;
  /** 실수령액. 생략하면 요금제 정가 (할인 판매를 장부에 그대로 남기기 위한 값). */
  amount?: number;
  memo?: string;
}

/** 판매 환불 요청 (job-054). 금액을 비우면 남은 전액을 환불한다. */
export interface RefundSaleRequest {
  amount?: number;
  reason?: string;
}

export interface RefundSaleResponse {
  refundAmount: number;
  isFullRefund: boolean;
  /** 회수한 잔여 횟수. 기간권이거나 이미 다 쓴 경우 0. */
  revokedCount: number;
  /**
   * 카드 결제였다면 토스 결제 키. **PG 취소는 자동으로 하지 않으므로**
   * 이 값이 있으면 원장이 `POST v1/payments/:paymentKey/cancel` 을 따로 실행해야 한다.
   */
  paymentKey: string | null;
}
