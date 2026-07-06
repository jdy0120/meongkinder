import { Module } from "@nestjs/common";
import { AdminController } from "./controllers/admin.controller";
import { AdminService } from "./services/admin.service";
import { TermsModule } from "../terms/terms.module";

@Module({
  imports: [TermsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
