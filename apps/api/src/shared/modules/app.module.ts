import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnApplicationShutdown,
} from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AuthModule } from "../../auth/auth.module";
import { MailModule } from "./mail.module";
import { prismaDisconnect } from "@pawlog/database";
import { LoggerMiddleware } from "../middleware/logger.middleware";
import { TenantMiddleware } from "../middleware/tenant.middleware";
import { JwtAccessGuard } from "../guards/jwt-access.guard";
import { RolesGuard } from "../guards/roles.guard";
import { TransformInterceptor } from "../interceptors/transform.interceptor";
import { JwtAccessStrategy, JwtRefreshStrategy } from "../configs";
import { FileModule } from "../file/file.module";
import { PaymentModule } from "../../payment/payment.module";
import { AdminModule } from "../../admin/admin.module";
import { RedisModule } from "../redis/redis.module";
import { LlmModule } from "../llm/llm.module";
import { GeoModule } from "../geo/geo.module";
import { SubscriptionModule } from "../../subscription/subscription.module";
import { TermsModule } from "../../terms/terms.module";
import { HealthModule } from "../../health/health.module";
import { LoggerModule } from "../logger/logger.module";
import { appLogger } from "../logger";
import { PetModule } from "../../pet/pet.module";
import { CareModule } from "../../care/care.module";
import { FeedModule } from "../../feed/feed.module";
import { NotificationModule } from "../../notification/notification.module";
import { TenantModule } from "../../tenant/tenant.module";
import { MembershipModule } from "../../membership/membership.module";
import { PlatformModule } from "../../platform/platform.module";

@Module({
  imports: [
    PassportModule,
    RedisModule,
    LlmModule,
    GeoModule,
    LoggerModule,
    AuthModule,
    MailModule,
    FileModule,
    PaymentModule,
    AdminModule,
    ScheduleModule.forRoot(),
    SubscriptionModule,
    TermsModule,
    HealthModule,
    PetModule,
    NotificationModule,
    CareModule,
    FeedModule,
    TenantModule,
    MembershipModule,
    PlatformModule,
    // 전역 기본 rate limit: 1분당 100회 (일반 API 보호).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
    // JwtAccessGuard 다음에 실행 — req.user.role 로 역할 검사
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 성공 응답을 BaseResponse 로 감싼다 (Reflector 주입 위해 DI 등록)
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    JwtAccessStrategy,
    JwtRefreshStrategy,
  ],
})
export class AppModule implements NestModule, OnApplicationShutdown {
  configure(consumer: MiddlewareConsumer) {
    // TenantMiddleware 가 ALS 테넌트 컨텍스트를 먼저 세팅해야 이후의 LoggerMiddleware/컨트롤러
    // 인터셉터(예: multer FileInterceptor)가 올바른 tenantId 스코프 아래에서 동작한다.
    consumer.apply(TenantMiddleware, LoggerMiddleware).forRoutes("*path");
  }

  async onApplicationShutdown(signal?: string) {
    appLogger.log(`Received signal: ${signal}. Disconnecting Prisma...`);
    await prismaDisconnect();
    appLogger.log("✅ Prisma disconnected successfully!");
  }
}
