import "./shared/configs/env"; // 👈 반드시 최상단 — 다른 어떤 모듈보다 먼저 환경변수 검증
import "./shared/configs/serialization.config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./shared/modules/app.module";
import { setupApplication } from "./shared/configs/app.setup"; // 👈 불러오기
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
}
bootstrap();
