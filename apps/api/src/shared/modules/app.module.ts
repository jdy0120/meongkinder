import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnApplicationShutdown,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AuthModule } from "../../auth/auth.module";
import { MailModule } from "./mail.module";
import { prismaDisconnect } from "@template/database";
import { LoggerMiddleware } from "../middleware/logger.middleware";
import { JwtAccessGuard } from "../guards/jwt-access.guard";
import { RolesGuard } from "../guards/roles.guard";
import {
  JwtAccessStrategy,
  JwtRefreshStrategy,
} from "../configs/passport.config";
import { FileModule } from "../file/file.module";
import { PaymentModule } from "../../payment/payment.module";
import { AdminModule } from "../../admin/admin.module";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    PassportModule,
    RedisModule,
    AuthModule,
    MailModule,
    FileModule,
    PaymentModule,
    AdminModule,
    // OTP 엔드포인트 브루트포스 방지: 1분에 최대 5회
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
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
    JwtAccessStrategy,
    JwtRefreshStrategy,
  ],
})
export class AppModule implements NestModule, OnApplicationShutdown {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*path");
  }

  async onApplicationShutdown(signal?: string) {
    console.log(`\nReceived signal: ${signal}. Disconnecting Prisma...`);
    await prismaDisconnect();
    console.log("✅ Prisma disconnected successfully!");
  }
}
