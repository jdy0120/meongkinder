import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, prismaConnect, prismaDisconnect } from "@pawlog/database";
import { ROLES } from "@pawlog/shared";
import * as bcrypt from "bcryptjs";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  asTenant,
  cleanupAll,
  openTenant,
  signupAndLogin,
  TEST_PASSWORD,
  V1_AUTH,
  type SignedUpUser,
} from "./utils/tenant-setup";

const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_ADMIN = `${PREFIX}/v1/admin`;

/**
 * 약관(Terms)은 tenant_id 가 없는 **플랫폼 공용** 테이블이라(terms.prisma) Prisma Extension 의
 * 자동 테넌트 스코프가 걸리지 않는다. 그래서 `v1/admin` 컨트롤러의 클래스 기본값
 * (`@Roles(TENANT_ADMIN, SUPER_ADMIN)`)을 그대로 쓰면, 아무 매장의 관리자가 전 플랫폼 약관을
 * 조회·등록·활성화할 수 있었다.
 *
 * 이 스펙은 약관 핸들러만 SUPER_ADMIN 으로 좁혀졌는지, 그리고 그 과정에서 같은 컨트롤러의
 * 테넌트 스코프 엔드포인트(회원 목록 등)까지 잘못 잠기지는 않았는지를 함께 고정한다.
 */
describe("Admin terms (e2e) — 플랫폼 공용 약관은 SUPER_ADMIN 전용", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  const SUPER_ADMIN_EMAIL = "terms-platform-admin@pawlog.test";
  const SEEDED_TERMS_TYPE = "E2E_TERMS_ACCESS";

  let superAdmin: ReturnType<typeof request.agent>;
  let tenantAdmin: SignedUpUser;
  let tenant: { id: string };
  let seededTermsId: string;

  beforeAll(async () => {
    if (!(process.env.DATABASE_URL ?? "").includes("template_test")) {
      throw new Error(
        "[e2e] DATABASE_URL 이 테스트 DB(template_test)가 아니라 중단합니다.",
      );
    }

    await prismaConnect();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApplication(app);
    await app.init();

    await cleanupAll();
    await prisma.terms.deleteMany({ where: { type: SEEDED_TERMS_TYPE } });

    // SUPER_ADMIN 은 승격 API 로 만들 수 없으므로 직접 심는다.
    await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        nickname: "terms-platform-admin",
        password: await bcrypt.hash(TEST_PASSWORD, 10),
        role: ROLES.SUPER_ADMIN,
      },
    });

    superAdmin = request.agent(server());
    await superAdmin
      .post(`${V1_AUTH()}/login`)
      .send({ email: SUPER_ADMIN_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    // 매장을 연 사람은 그 매장의 TENANT_ADMIN 이 된다.
    tenantAdmin = await signupAndLogin(server(), {
      email: "terms-tenant-admin@pawlog.test",
      nickname: "매장관리자",
    });
    tenant = await openTenant(tenantAdmin, {
      name: "약관테스트매장",
      subdomain: "terms-access",
    });

    const seeded = await prisma.terms.create({
      data: {
        title: "e2e 접근제어용 약관",
        type: SEEDED_TERMS_TYPE,
        version: "1.0.0",
        isRequired: true,
        isActive: false,
      },
    });
    seededTermsId = seeded.id;
  });

  afterAll(async () => {
    await prisma.terms.deleteMany({ where: { type: SEEDED_TERMS_TYPE } });
    await cleanupAll();
    await app.close();
    await prismaDisconnect();
  });

  describe("TENANT_ADMIN 은 약관을 다룰 수 없다", () => {
    const as = () => asTenant(tenantAdmin.session, tenant.id);

    it("목록 조회 403", async () => {
      await as().get(`${V1_ADMIN}/terms`).expect(403);
    });

    it("상세 조회 403", async () => {
      await as().get(`${V1_ADMIN}/terms/${seededTermsId}`).expect(403);
    });

    it("등록 403", async () => {
      await as()
        .post(`${V1_ADMIN}/terms`)
        .send({
          title: "매장이 만든 약관",
          type: SEEDED_TERMS_TYPE,
          version: "9.9.9",
          isRequired: true,
          isActive: true,
        })
        .expect(403);
    });

    it("활성화 토글 403", async () => {
      await as()
        .patch(`${V1_ADMIN}/terms/${seededTermsId}/active`)
        .send({ isActive: true })
        .expect(403);

      const after = await prisma.terms.findUniqueOrThrow({
        where: { id: seededTermsId },
      });
      expect(after.isActive).toBe(false);
    });

    it("X-Tenant-Id 없이(개인 스코프) 호출해도 막힌다", async () => {
      await tenantAdmin.session.get(`${V1_ADMIN}/terms`).expect(403);
    });
  });

  describe("같은 컨트롤러의 테넌트 스코프 엔드포인트는 그대로 열려 있다", () => {
    it("TENANT_ADMIN 은 자기 매장 회원 목록을 계속 볼 수 있다", async () => {
      await asTenant(tenantAdmin.session, tenant.id)
        .get(`${V1_ADMIN}/users`)
        .expect(200);
    });
  });

  describe("SUPER_ADMIN 은 테넌트 컨텍스트 없이 약관을 다룬다", () => {
    it("목록 조회 200", async () => {
      const res = await superAdmin.get(`${V1_ADMIN}/terms`).expect(200);
      const body = res.body as { data: { id: string }[] };
      expect(body.data.map((t) => t.id)).toContain(seededTermsId);
    });

    it("활성화 토글 200", async () => {
      await superAdmin
        .patch(`${V1_ADMIN}/terms/${seededTermsId}/active`)
        .send({ isActive: true })
        .expect(200);

      const after = await prisma.terms.findUniqueOrThrow({
        where: { id: seededTermsId },
      });
      expect(after.isActive).toBe(true);
    });
  });

  it("미인증은 401", async () => {
    await request(server()).get(`${V1_ADMIN}/terms`).expect(401);
  });
});
