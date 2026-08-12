import { Module } from "@nestjs/common";

import { MembershipModule } from "../membership/membership.module";
import { PlatformController } from "./controllers/platform.controller";
import { PlatformService } from "./services/platform.service";

@Module({
  // 계정 발급 시 대기 중인 초대를 소속 처리하기 위해 InvitationService 가 필요하다.
  imports: [MembershipModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
