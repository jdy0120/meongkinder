export const PAYMENT_ROUTES = {
  BASE: "v1/payments",
  CREATE_ORDER: "orders", // POST: 주문 생성
  LIST_ORDERS: "orders", // GET:  주문 목록 (페이지네이션)
  CONFIRM: "confirm", // POST: 결제 승인
  CANCEL: ":paymentKey/cancel", // POST: 결제 취소/환불
  WEBHOOK: "webhook", // POST: 토스 웹훅 수신 (공개)
  GET_ORDER: "orders/:orderId", // GET: 주문 조회
} as const;
