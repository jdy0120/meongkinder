import { NestFactory } from "@nestjs/core";
import { AppModule } from "./shared/modules/app.module";
import { setupApplication } from "./shared/configs/app.setup"; // 👈 불러오기
import { prismaConnect } from "@template/database";
async function bootstrap() {
  try {
    await prismaConnect();
    console.log("✅ 데이터베이스 연결 성공!");
  } catch (error) {
    console.error("❌ 데이터베이스 연결 실패:", error);
    process.exit(1);
  }
  const PORT = Number(process.env.SERVER_PORT) || 3000;

  // 1. NestJS 인스턴스 생성
  const app = await NestFactory.create(AppModule);
  // 2. 환경 설정 파일에 인스턴스를 넘겨 CORS, 미들웨어 등을 주입
  setupApplication(app);
  // 3. 포트 리스닝 시작
  await app.listen(PORT);
  console.log(`🚀 Server is running on port ${PORT}`);
}
bootstrap();
