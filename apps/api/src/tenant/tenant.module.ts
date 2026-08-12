import { Module } from "@nestjs/common";
import { SubscriptionModule } from "../subscription/subscription.module";
import { TenantController } from "./controllers/tenant.controller";
import { TenantService } from "./services/tenant.service";

@Module({
  // 온보딩이 매장 개설권을 검사·소비하므로 PlatformSubscriptionService 가 필요하다.
  imports: [SubscriptionModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
