import { Module } from "@nestjs/common";
import { MembershipModule } from "../membership/membership.module";
import { AuthController } from "./controllers/auth.controller";
import { SocialAuthController } from "./controllers/social-auth.controller";
import { AuthService } from "./services/auth.service";
import { SocialAuthService } from "./services/social-auth.service";

@Module({
  // 회원가입이 대기 중인 테넌트 초대를 소속 처리한다(InvitationService.claimForUser).
  imports: [MembershipModule],
  controllers: [AuthController, SocialAuthController],
  providers: [AuthService, SocialAuthService],
  exports: [AuthService, SocialAuthService],
})
export class AuthModule {}
