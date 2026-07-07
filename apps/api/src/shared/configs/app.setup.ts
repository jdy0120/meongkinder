import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"; // 👈 추가
import compression from "compression";
import cookieParser from "cookie-parser";

import { HttpErrorFilter } from "../filters/http-exception.filter";
import { TransformInterceptor } from "../interceptors/transform.interceptor";

export const setupApplication = (app: INestApplication) => {
  const PROJECT_NAME = process.env.PROJECT_NAME || "template-dev";

  app.enableShutdownHooks();

  // 글로벌 필터 및 인터셉터 등록
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // 1. 글로벌 프리픽스 설정
  app.setGlobalPrefix(`api/${PROJECT_NAME}`);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 2. Swagger 설정 추가 👈
  const config = new DocumentBuilder()
    .setTitle("template-dev API")
    .setDescription("template-dev Platform API 문서입니다.")
    .setVersion("1.0")
    // .addBearerAuth() // 필요 시 JWT 토큰 인증 기능 추가
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // 엔드포인트 경로: http://localhost:3000/api/template-dev/docs
  SwaggerModule.setup(`api/${PROJECT_NAME}/docs`, app, document);

  // 3. CORS 설정
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:3001"];

  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  app.use(compression());
  app.use(cookieParser());
};
