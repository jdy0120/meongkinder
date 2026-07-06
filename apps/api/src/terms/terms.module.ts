import { Module } from "@nestjs/common";
import { TermsController } from "./controllers/terms.controller";
import { TermsService } from "./services/terms.service";
import { FileModule } from "../shared/file/file.module";

@Module({
  imports: [FileModule],
  controllers: [TermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}
