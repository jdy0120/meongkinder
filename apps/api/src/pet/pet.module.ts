import { Module } from "@nestjs/common";
import { PetController } from "./controllers/pet.controller";
import { PetReservationService } from "./services/pet-reservation.service";
import { PetService } from "./services/pet.service";
import { FileModule } from "../shared/file/file.module";
import { SubscriptionModule } from "../subscription/subscription.module";

@Module({
  imports: [
    // FileModule: 프로필 사진의 임시 업로드를 영구 저장소로 옮긴다 (job-053).
    FileModule,
    // SubscriptionModule: 등원 예약이 이용권 잔액을 봐야 한다 (job-060).
    // 잔액 계산을 여기서 다시 구현하지 않는다 — `SubscriptionLedger` 는 append-only 라
    // "마지막 줄의 balanceAfter" 가 진실인데, 그 규칙이 두 곳에 생기면 환불·소멸 보정이
    // 섞였을 때 예약 화면과 출석 차감이 서로 다른 잔액을 말하게 된다.
    SubscriptionModule,
  ],
  controllers: [PetController],
  providers: [PetService, PetReservationService],
  exports: [PetService],
})
export class PetModule {}
