import { Module } from "@nestjs/common";
import { SubscriptionController } from "./controllers/subscription.controller";
import { SubscriptionLedgerController } from "./controllers/subscription-ledger.controller";
import { SubscriptionSchedulerService } from "./services/subscription-scheduler.service";
import { SubscriptionService } from "./services/subscription.service";
import { SubscriptionLedgerService } from "./services/subscription-ledger.service";

@Module({
  controllers: [SubscriptionController, SubscriptionLedgerController],
  providers: [
    SubscriptionService,
    SubscriptionSchedulerService,
    SubscriptionLedgerService,
  ],
  exports: [SubscriptionService, SubscriptionLedgerService],
})
export class SubscriptionModule {}
