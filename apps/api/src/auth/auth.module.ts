import { Module } from "@nestjs/common";
import { MembershipModule } from "../membership/membership.module";
import { NotificationModule } from "../notification/notification.module";
import { FileModule } from "../shared/file/file.module";
import { AuthController } from "./controllers/auth.controller";
import { SocialAuthController } from "./controllers/social-auth.controller";
import { AuthService } from "./services/auth.service";
import { SocialAuthService } from "./services/social-auth.service";
import { PhoneOtpService } from "./services/phone-otp.service";

@Module({
  imports: [
    // 회원가입이 대기 중인 테넌트 초대를 소속 처리한다(InvitationService.claimForUser).
    MembershipModule,
    // job-042: 휴대폰 본인확인 문자를 보낸다(SolapiClientService).
    NotificationModule,
    // job-063: 프로필 사진의 임시 업로드를 영구 저장소로 옮긴다(FileService).
    FileModule,
  ],
  controllers: [AuthController, SocialAuthController],
  providers: [AuthService, SocialAuthService, PhoneOtpService],
  exports: [AuthService, SocialAuthService, PhoneOtpService],
})
export class AuthModule {}
