import { Module } from "@nestjs/common";
import { NotificationModule } from "../notification/notification.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { TenantController } from "./controllers/tenant.controller";
import { TenantService } from "./services/tenant.service";

@Module({
  // 온보딩이 매장 개설권을 검사·소비하므로 PlatformSubscriptionService 가 필요하다.
  // job-060: 임시 휴무 등록이 그 날 예약된 보호자에게 통보를 보내므로 NotificationService
  // 도 필요하다. NotificationModule 은 아무 모듈도 import 하지 않아 순환이 생기지 않는다.
  imports: [SubscriptionModule, NotificationModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
