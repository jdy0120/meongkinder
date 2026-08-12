import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"; // 👈 추가
import compression from "compression";
import cookieParser from "cookie-parser";

import { HttpErrorFilter } from "../filters/http-exception.filter";

export const setupApplication = (app: INestApplication) => {
  const PROJECT_NAME = process.env.PROJECT_NAME || "template-dev";

  app.enableShutdownHooks();

  // 글로벌 필터 등록
  // TransformInterceptor 는 Reflector 주입이 필요하므로 app.module 에서 APP_INTERCEPTOR 로 등록한다.
  app.useGlobalFilters(new HttpErrorFilter());

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
  // 테넌트 서브도메인(예: acme.pawlog-dev.doyeonism.com, acme.lvh.me:3001)에서의 요청을 허용하려면
  // ALLOWED_ORIGINS 항목에 `*` 와일드카드를 한 번 넣을 수 있다 (예: https://*.pawlog-dev.doyeonism.com).
  // `*` 가 없는 항목은 기존과 동일하게 완전 일치만 허용한다.
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["http://localhost:3000", "http://localhost:3001"];

  const isOriginAllowed = (origin: string): boolean =>
    allowedOrigins.some((pattern) =>
      pattern.includes("*")
        ? wildcardOriginToRegExp(pattern).test(origin)
        : pattern === origin,
    );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Origin 헤더가 없는 요청(서버 간 호출, curl 등)은 브라우저 CORS 대상이 아니므로 통과시킨다.
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS: 허용되지 않은 origin 입니다 (${origin})`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  app.use(compression());
  app.use(cookieParser());

  // 4. `/resources` 정적 마운트는 job-024 에서 제거됨 — 인증 없이 경로만 알면 크로스 테넌트 파일
  // 유출로 이어질 수 있어, 인증 + 소유권 검사를 거치는 GET v1/file/:fileId/raw 스트리밍 엔드포인트로
  // 대체했다 (apps/api/src/shared/file).
};

/** `*` 를 서브도메인 세그먼트(영숫자+하이픈)로 치환해 origin 완전일치용 정규식으로 변환한다. */
function wildcardOriginToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withWildcard = escaped.replace(/\*/g, "[a-z0-9-]+");
  return new RegExp(`^${withWildcard}$`, "i");
}
