import { Module } from "@nestjs/common";
import { PetController } from "./controllers/pet.controller";
import { PetService } from "./services/pet.service";
import { FileModule } from "../shared/file/file.module";

@Module({
  // FileModule: 프로필 사진의 임시 업로드를 영구 저장소로 옮긴다 (job-053).
  imports: [FileModule],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
