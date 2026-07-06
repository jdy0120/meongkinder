import { Module } from "@nestjs/common";
import { SubscriptionController } from "./controllers/subscription.controller";
import { SubscriptionSchedulerService } from "./services/subscription-scheduler.service";
import { SubscriptionService } from "./services/subscription.service";

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionSchedulerService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
