import type { SubscriptionLedger } from "@pawlog/database";

export interface CreateSubscriptionLedgerRequest {
  userId: string;
  subscriptionId?: string;
  attendanceId?: string;
  type: string; // CHARGE | USE | REFUND | EXPIRE
  amount: number;
  balanceAfter: number;
  description?: string;
}

export type UpdateSubscriptionLedgerRequest = Partial<
  Omit<CreateSubscriptionLedgerRequest, "userId">
>;

export interface SubscriptionLedgerResponse {
  ledger: SubscriptionLedger;
}
