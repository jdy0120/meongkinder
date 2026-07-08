// 결제 도메인 API 계약 (request / response)
// - request : api 의 DTO 가 implements 하여 계약 준수를 강제
// - response: 서버가 내려주는 data 페이로드 형태 (BaseResponse<T> 의 T)
import type { PaginationQuery } from "../pagination";

// ── 요청 ──────────────────────────────────────────────
export interface CreateOrderRequest {
  orderName: string;
  amount: number;
}

export interface ConfirmPaymentRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface CancelPaymentRequest {
  cancelReason: string;
  cancelAmount?: number;
}

export type ListOrdersQuery = PaginationQuery;

// ── 응답 (data 페이로드) ──────────────────────────────
// 성공 message 는 BaseResponse.message(봉투)에 담긴다. 아래 타입은 data 페이로드만 기술.
export interface CreateOrderResponse {
  orderId: string;
  orderName: string;
  amount: number;
}

export interface PaymentResultResponse {
  paymentKey: string;
  amount?: number;
  status: string;
}
