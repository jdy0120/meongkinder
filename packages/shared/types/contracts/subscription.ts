import type { SubscriptionPlan, UserSubscription } from "@template/database";

export interface IssueBillingKeyRequest {
  authKey: string;
  customerKey: string;
}

export interface IssueBillingKeyResponse {
  message: string;
  cardName: string | null;
  cardNumber: string | null;
}

export interface CreateSubscriptionRequest {
  planId: string;
}

export interface CreateSubscriptionResponse {
  message: string;
  subscription: UserSubscription;
}

export interface CancelSubscriptionResponse {
  message: string;
  subscription: UserSubscription;
}

export interface MySubscriptionResponse {
  subscription: (UserSubscription & { plan: SubscriptionPlan }) | null;
  billingKey: {
    cardName: string | null;
    cardNumber: string | null;
  } | null;
}
