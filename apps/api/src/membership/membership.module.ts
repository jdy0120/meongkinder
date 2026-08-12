import { Module } from "@nestjs/common";

import { MembershipController } from "./controllers/membership.controller";
import { InvitationController } from "./controllers/invitation.controller";
import { MembershipService } from "./services/membership.service";
import { InvitationService } from "./services/invitation.service";

@Module({
  controllers: [MembershipController, InvitationController],
  providers: [MembershipService, InvitationService],
  // AuthModule 의 회원가입이 InvitationService.claimForUser 로 대기 중인 초대를 소속 처리한다.
  exports: [MembershipService, InvitationService],
})
export class MembershipModule {}
