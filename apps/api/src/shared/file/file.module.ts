import { Module } from "@nestjs/common";
import { FileController } from "./controllers/file.controller";
import { FileService } from "./services/file.service";
import { FileSchedulerService } from "./services/file-scheduler.service";

@Module({
  controllers: [FileController],
  providers: [FileService, FileSchedulerService],
  exports: [FileService],
})
export class FileModule {}
