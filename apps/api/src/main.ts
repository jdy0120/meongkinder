import "./shared/configs/env"; // 👈 반드시 최상단 — 다른 어떤 모듈보다 먼저 환경변수 검증
import "./shared/configs/serialization.config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./shared/modules/app.module";
import { setupApplication } from "./shared/configs/app.setup"; // 👈 불러오기
import { seatConfig } from "./shared/configs/seat.config";
import { otpConfig } from "./shared/configs/otp.config";
import { prismaConnect } from "@pawlog/database";

import { WinstonLogger } from "./shared/logger/logger.service";
import { bootstrapLogger } from "./shared/logger";

async function bootstrap() {
  // 1. NestJS 인스턴스 생성 (WinstonLogger 등록)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new WinstonLogger(),
  });

  try {
    await prismaConnect();
    bootstrapLogger.log("✅ 데이터베이스 연결 성공!");
  } catch (error) {
    bootstrapLogger.error("❌ 데이터베이스 연결 실패:", error);
    process.exit(1);
  }

  const PORT = Number(process.env.SERVER_PORT) || 3000;

  // 2. 환경 설정 파일에 인스턴스를 넘겨 CORS, 미들웨어 등을 주입
  setupApplication(app);
  // 3. 포트 리스닝 시작
  await app.listen(PORT);
  bootstrapLogger.log(`🚀 Server is running on port ${PORT}`);

  // job-042: 본인확인을 끈 상태는 남의 번호로 남의 아이 기록에 닿을 수 있다는 뜻이다.
  if (otpConfig.allowUnverified) {
    bootstrapLogger.warn(
      "⚠️  ALLOW_UNVERIFIED_PHONE=true — 휴대폰 본인확인 없이 전화번호가 저장됩니다. " +
        "남의 번호를 입력해 그 아이의 알림장·사진에 접근할 수 있습니다. 운영 배포 전 반드시 끄세요.",
    );
  }

  // job-056: 임시 토글이라 켜져 있다는 사실이 잊히면 안 된다. 매 부팅마다 눈에 띄게 남긴다.
  if (seatConfig.allowUnpaid) {
    bootstrapLogger.warn(
      "⚠️  ALLOW_UNPAID_TENANT_SEAT=true — 매장 개설권이 결제 없이 발급됩니다. 운영 배포 전 반드시 끄세요.",
    );
  }
}
void bootstrap();
