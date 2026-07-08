import type { SubscriptionPlan, UserSubscription } from "@template/database";

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
  subscription: UserSubscription;
}

export interface CancelSubscriptionResponse {
  subscription: UserSubscription;
}

export interface MySubscriptionResponse {
  subscription: (UserSubscription & { plan: SubscriptionPlan }) | null;
  billingKey: {
    cardName: string | null;
    cardNumber: string | null;
  } | null;
}
