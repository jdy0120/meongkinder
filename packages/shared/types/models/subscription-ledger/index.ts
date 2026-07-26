import { SubscriptionLedger as SubscriptionLedgerModel } from "@pawlog/database";
import { AsCreateRequest, AsUpdateRequest } from "../";

export type SubscriptionLedger = SubscriptionLedgerModel;
export type SubscriptionLedgerCreateInput = AsCreateRequest<SubscriptionLedger>;
export type SubscriptionLedgerUpdateInput = AsUpdateRequest<SubscriptionLedger>;
