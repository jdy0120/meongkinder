import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SubscriptionService } from "./subscription.service";

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  // 매일 새벽 2시에 정기 결제 갱신 배치 처리
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleRenewal() {
    this.logger.log("정기 결제 배치 처리를 시작합니다...");
    await this.subscriptionService.processRenewals();
    this.logger.log("정기 결제 배치 처리가 완료되었습니다.");
  }

  // 매일 새벽 3시에 만료 구독 정리 배치 처리
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpirations() {
    this.logger.log("만료 구독 정리 배치 처리를 시작합니다...");
    await this.subscriptionService.processExpirations();
    this.logger.log("만료 구독 정리 배치 처리가 완료되었습니다.");
  }
}
