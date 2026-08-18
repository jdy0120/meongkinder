import type { SubscriptionLedger } from "@pawlog/database";

export interface CreateSubscriptionLedgerRequest {
  petId: string;
  userId?: string;
  subscriptionId?: string;
  attendanceId?: string;
  type: string; // CHARGE | USE | UNPAID_USE(잔액 0인데 등원 — 미수) | REFUND | EXPIRE
  amount: number;
  description?: string;
}

export type UpdateSubscriptionLedgerRequest = Partial<
  Omit<CreateSubscriptionLedgerRequest, "userId">
>;

export interface SubscriptionLedgerResponse {
  ledger: SubscriptionLedger;
}

/**
 * 이용권 충전 (job-045). 잔액은 **아이 단위**로 쌓이므로 대상은 원생이다.
 * `balanceAfter` 는 요청에 없다 — 서버가 계산한다(동시 요청이 서로 덮어쓰지 않도록).
 */
export interface ChargeLedgerRequest {
  petId: string;
  amount: number;
  description?: string;
}

/** 보호자 - 내 아이별 이용권 잔액과 최근 사용 내역 */
export interface MyLedgerByPet {
  petId: string;
  petName: string;
  balance: number;
  recent: SubscriptionLedger[];
}

export interface MyLedgerResponse {
  pets: MyLedgerByPet[];
}
