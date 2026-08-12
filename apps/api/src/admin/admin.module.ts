import { Module } from "@nestjs/common";
import { AdminController } from "./controllers/admin.controller";
import { AdminService } from "./services/admin.service";
import { PetIntakeService } from "./services/pet-intake.service";
import { DashboardService } from "./services/dashboard.service";
import { PetScheduleService } from "./services/pet-schedule.service";
import { TermsModule } from "../terms/terms.module";
import { MembershipModule } from "../membership/membership.module";
import { FileModule } from "../shared/file/file.module";

@Module({
  // MembershipModule: 원생 등록 단일 진입점이 미가입 보호자용 초대장을 남길 때
  // InvitationService.createForExistingPet 을 쓴다 (job-040).
  // FileModule: 원생 프로필 사진의 임시 업로드를 영구 저장소로 옮긴다 (job-053).
  imports: [TermsModule, MembershipModule, FileModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    PetIntakeService,
    DashboardService,
    PetScheduleService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
