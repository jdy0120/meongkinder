import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnApplicationShutdown,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { AuthModule } from "../../auth/auth.module";
import { MailModule } from "./mail.module";
import { prismaDisconnect } from "@template/database";
import { LoggerMiddleware } from "../middleware/logger.middleware";
import { JwtAccessGuard } from "../guards/jwt-access.guard";
import {
  JwtAccessStrategy,
  JwtRefreshStrategy,
} from "../configs/passport.config";
import { FileModule } from "../file/file.module";

@Module({
  imports: [PassportModule, AuthModule, MailModule, FileModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
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
