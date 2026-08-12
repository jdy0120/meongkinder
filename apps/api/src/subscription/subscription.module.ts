import { Module } from "@nestjs/common";
import { NotificationModule } from "../notification/notification.module";
import { SubscriptionController } from "./controllers/subscription.controller";
import { SubscriptionLedgerController } from "./controllers/subscription-ledger.controller";
import { PlatformSubscriptionController } from "./controllers/platform-subscription.controller";
import { RevenueController } from "./controllers/revenue.controller";
import { RevenueService } from "./services/revenue.service";
import { SubscriptionSchedulerService } from "./services/subscription-scheduler.service";
import { SubscriptionService } from "./services/subscription.service";
import { SubscriptionLedgerService } from "./services/subscription-ledger.service";
import { PlatformSubscriptionService } from "./services/platform-subscription.service";
import { TossClientService } from "./services/toss-client.service";

@Module({
  imports: [NotificationModule],
  controllers: [
    SubscriptionController,
    SubscriptionLedgerController,
    PlatformSubscriptionController,
    RevenueController,
  ],
  providers: [
    SubscriptionService,
    SubscriptionSchedulerService,
    SubscriptionLedgerService,
    PlatformSubscriptionService,
    RevenueService,
    TossClientService,
  ],
  // PlatformSubscriptionService 는 TenantModule 의 온보딩 게이트가 사용한다.
  exports: [
    SubscriptionService,
    SubscriptionLedgerService,
    PlatformSubscriptionService,
  ],
})
export class SubscriptionModule {}
