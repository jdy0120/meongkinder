import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { SocialAuthController } from "./controllers/social-auth.controller";
import { AuthService } from "./services/auth.service";
import { SocialAuthService } from "./services/social-auth.service";

@Module({
  controllers: [AuthController, SocialAuthController],
  providers: [AuthService, SocialAuthService],
  exports: [AuthService, SocialAuthService],
})
export class AuthModule {}
