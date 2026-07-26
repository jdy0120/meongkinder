export const SUBSCRIPTION_ROUTES = {
  BASE: "v1/subscriptions",
  PLANS: "plans",
  BILLING_KEY: "billing-key",
  SUBSCRIBE: "subscribe",
  CANCEL: "cancel",
  MINE: "mine",
} as const;

export const SUBSCRIPTION_LEDGER_ROUTES = {
  BASE: "v1/subscriptions/ledgers",
  MINE: "mine", // GET: 내 정기권/회수권 사용 내역
  LIST: "", // GET (ADMIN): 전체 내역 목록
  CREATE: "", // POST (ADMIN): 내역 수동 생성/보정
  GET: ":id", // GET (ADMIN): 상세 조회
  UPDATE: ":id", // PATCH (ADMIN): 내역 수정
  DELETE: ":id", // DELETE (ADMIN): 내역 삭제
} as const;
