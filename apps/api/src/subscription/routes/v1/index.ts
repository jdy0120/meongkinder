export const SUBSCRIPTION_ROUTES = {
  BASE: "v1/subscriptions",
  PLANS: "plans", // GET (공개): 판매 중인 요금제 목록
  PLANS_ALL: "plans/all", // GET (ADMIN): 전체 요금제 목록 (비활성 포함, 페이지네이션)
  PLAN_CREATE: "plans", // POST (ADMIN): 요금제 등록
  PLAN_DETAIL: "plans/:id", // GET (ADMIN): 요금제 상세
  PLAN_UPDATE: "plans/:id", // PATCH (ADMIN): 요금제 수정
  PLAN_DELETE: "plans/:id", // DELETE (ADMIN): 요금제 판매 중지 (soft delete)
  BILLING_KEY: "billing-key",
  SUBSCRIBE: "subscribe",
  CANCEL: "cancel",
  PAUSE: "pause", // POST: 이용 중인 정기권 일시정지(휴회)
  RESUME: "resume", // POST: 일시정지(휴회) 해제 및 재개
  MINE: "mine",
  MY_TICKETS: "my-tickets", // GET: 나의 정기권/회수권(티켓) 목록 + 잔여 횟수
  USAGE_HISTORY: ":id/usage-history", // GET: 특정 정기권/회수권 사용 내역 (페이지네이션)
} as const;

/**
 * 매출 (job-051) — 유치원이 번 돈. 매장 화면(`/tenant/[tenant]/revenue`)이 쓴다.
 *
 * 원장이 pawlog 에 내는 **개설권 비용은 여기 섞이지 않는다**(그건 UserSubscription 이고
 * 플랫폼 콘솔의 것이다). 이 경로가 답하는 질문은 "우리 유치원이 이번 달 얼마 벌었나" 하나다.
 */
export const REVENUE_ROUTES = {
  BASE: "v1/revenue",
  MONTHLY: "monthly", // GET ?months=: 최근 N개월 매출 추이
  SUMMARY: "summary", // GET ?year=&month=: 특정 월 상세 (결제수단별·요금제별·건별)
  DAILY: "daily", // GET ?year=&month=: 그 달의 **날짜별** 매출 (달력용, job-063)
} as const;

/**
 * 매장 개설권 구독 (job-034) — 주체가 테넌트가 아닌 **회원**이라 경로를 분리한다.
 * 원생 이용권(SUBSCRIPTION_ROUTES)과 달리 테넌트 컨텍스트 없이 호출된다.
 */
export const PLATFORM_SUBSCRIPTION_ROUTES = {
  BASE: "v1/platform-subscriptions",
  PLANS: "plans", // GET (공개): 판매 중인 매장 개설권 요금제
  BILLING_KEY: "billing-key", // POST: 회원 소유 카드 등록
  SUBSCRIBE: "subscribe", // POST: 개설권 구독 + 첫 결제
  MINE: "mine", // GET: 내 개설권 목록 (사용/미사용)
  CANCEL: ":id/cancel", // POST: 구독 해지 예약
} as const;

export const SUBSCRIPTION_LEDGER_ROUTES = {
  BASE: "v1/subscriptions/ledgers",
  MINE: "mine", // GET: 보호자 - 내 아이별 잔액 + 최근 내역 (job-045)
  SELL: "sell", // POST: (원장) 현장 판매 — 요금제를 골라 대면 결제로 이용권 개통 (job-051)
  REFUND_SALE: "sales/:id/refund", // POST: (원장) 판매 환불 — 매출 차감 + 잔여 횟수 회수 (job-054)
  CHARGE: "charge", // POST: (원장) 횟수 수동 보정 — 매출을 만들지 않는다 (보상·오류 정정)
  BALANCE: "balance/:petId", // GET: 아이 1마리의 현재 잔여 횟수
  LIST: "", // GET (ADMIN): 전체 내역 목록
  CREATE: "", // POST (ADMIN): 내역 수동 생성/보정
  GET: ":id", // GET (ADMIN): 상세 조회
  UPDATE: ":id", // PATCH (ADMIN): 내역 수정
  DELETE: ":id", // DELETE (ADMIN): 내역 삭제
} as const;
