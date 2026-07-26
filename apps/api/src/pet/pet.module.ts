import { Module } from "@nestjs/common";
import { PetController } from "./controllers/pet.controller";
import { PetService } from "./services/pet.service";

@Module({
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
