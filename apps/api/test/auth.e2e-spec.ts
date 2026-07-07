import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ROLES } from "@template/shared";
import { prisma, prismaConnect, prismaDisconnect } from "@template/database";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";

// setupApplication 이 붙이는 글로벌 프리픽스: api/${PROJECT_NAME}
const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_AUTH = `${PREFIX}/v1/auth`;
const V1_ADMIN = `${PREFIX}/v1/admin`;

const password = "password1234";

/** TransformInterceptor 가 감싸는 응답 형태 */
type ApiBody = {
  result: boolean;
  message: string;
  data: { user: { email: string; role: string } };
};

describe("Auth (e2e)", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    // 안전 가드 — deleteMany 가 운영/개발 DB 를 지우는 사고 방지(방어 심화).
    if (!(process.env.DATABASE_URL ?? "").includes("template_test")) {
      throw new Error(
        "[e2e] DATABASE_URL 이 테스트 DB(template_test)가 아니라 중단합니다.",
      );
    }

    // AppModule 은 자동으로 prisma 를 연결하지 않는다(main.ts 가 함). 직접 연결.
    await prismaConnect();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApplication(app); // 프리픽스·쿠키파서·ValidationPipe·인터셉터·필터 적용
    await app.init();

    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
    await prismaDisconnect();
  });

  describe("signup → login → 보호 라우트 → refresh → logout", () => {
    const email = "flow@example.com";
    let session: ReturnType<typeof request.agent>;

    beforeAll(() => {
      session = request.agent(server());
    });

    it("signup: 공개 라우트, 201", async () => {
      const res = await session
        .post(`${V1_AUTH}/signup`)
        .send({ email, password, nickname: "flow" })
        .expect(201);

      const body = res.body as ApiBody;
      expect(body.result).toBe(true);
      expect(body.data.user.email).toBe(email);
    });

    it("login: 200 + httpOnly 쿠키 발급", async () => {
      const res = await session
        .post(`${V1_AUTH}/login`)
        .send({ email, password })
        .expect(200);

      const cookies = (res.headers["set-cookie"] ?? []) as string[];
      expect(cookies.join(";")).toContain("access_token");
      expect(cookies.join(";")).toContain("refresh_token");
    });

    it("mypage: 쿠키로 인증된 요청은 200", async () => {
      const res = await session.get(`${V1_AUTH}/mypage`).expect(200);
      expect((res.body as ApiBody).data.user.email).toBe(email);
    });

    it("refresh: refresh 쿠키로 토큰 재발급 200", async () => {
      await session.post(`${V1_AUTH}/refresh`).expect(200);
    });

    it("logout: 200", async () => {
      await session.post(`${V1_AUTH}/logout`).expect(200);
    });
  });

  describe("인증/인가 가드", () => {
    it("mypage: 토큰 없으면 401", async () => {
      await request(server()).get(`${V1_AUTH}/mypage`).expect(401);
    });

    it("admin: USER 역할은 403 (RolesGuard)", async () => {
      const email = "user-role@example.com";
      const session = request.agent(server());
      await session
        .post(`${V1_AUTH}/signup`)
        .send({ email, password, nickname: "user" })
        .expect(201);
      await session
        .post(`${V1_AUTH}/login`)
        .send({ email, password })
        .expect(200);

      await session.get(`${V1_ADMIN}/me`).expect(403);
    });

    it("admin: ADMIN 역할은 200", async () => {
      const email = "admin-role@example.com";
      const session = request.agent(server());
      await session
        .post(`${V1_AUTH}/signup`)
        .send({ email, password, nickname: "admin" })
        .expect(201);

      // USER → ADMIN 승격 후 재로그인(새 토큰에 role=ADMIN 반영)
      await prisma.user.update({
        where: { email },
        data: { role: ROLES.ADMIN },
      });
      await session
        .post(`${V1_AUTH}/login`)
        .send({ email, password })
        .expect(200);

      const res = await session.get(`${V1_ADMIN}/me`).expect(200);
      expect((res.body as ApiBody).data.user.role).toBe(ROLES.ADMIN);
    });
  });
});
