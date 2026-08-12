import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, prismaConnect, prismaDisconnect } from "@pawlog/database";
import { ROLES } from "@pawlog/shared";
import * as bcrypt from "bcryptjs";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import { cleanupAll, openTenant, signupAndLogin } from "./utils/tenant-setup";

// setupApplication 이 붙이는 글로벌 프리픽스: api/${PROJECT_NAME}
const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_AUTH = `${PREFIX}/v1/auth`;
const V1_TENANTS = `${PREFIX}/v1/tenants`;
const V1_ADMIN = `${PREFIX}/v1/admin`;

const password = "password1234";

type TenantListBody = {
  data: {
    items: {
      id: string;
      name: string;
      subdomain: string;
      isActive: boolean;
      _count: { memberships: number; pets: number };
    }[];
    meta: { total: number };
  };
};
type TenantDetailBody = {
  data: {
    id: string;
    name: string;
    _count: { memberships: number; pets: number };
  };
};
type UpdateTenantBody = {
  data: { tenant: { id: string; name: string; subdomain: string } };
};
type ActiveBody = { data: { tenant: { id: string; isActive: boolean } } };
type UserListBody = {
  data: { items: { id: string; email: string }[]; meta: { total: number } };
};

describe("Tenant Management (e2e) — SUPER_ADMIN 테넌트 관리 + 헤더 스푸핑 차단", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  const TENANT_SUBDOMAINS = ["mgmt-tenant-a", "mgmt-tenant-b", "mgmt-renamed"];
  const SUPER_ADMIN_EMAIL = "platform-owner@pawlog.test";

  const cleanup = cleanupAll;

  beforeAll(async () => {
    // 안전 가드 — deleteMany 가 운영/개발 DB 를 지우는 사고 방지(방어 심화).
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

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    await prismaDisconnect();
  });

  /** job-034: 회원가입 → 개설권 지급 → 온보딩. 개설자가 TENANT_ADMIN 이 된다. */
  const onboardTenant = async (subdomain: string, adminEmail: string) => {
    const owner = await signupAndLogin(server(), {
      email: adminEmail,
      nickname: `${subdomain}-admin`,
    });
    const tenant = await openTenant(owner, {
      name: `${subdomain}-name`,
      subdomain,
    });
    return { tenant, owner };
  };

  /**
   * SUPER_ADMIN 은 승격 API(@Roles 로 부여 불가)로 만들 수 없으므로 DB 에 직접 심는다.
   * tenantId: null 이 SUPER_ADMIN 의 정의(특정 테넌트에 속하지 않음)다.
   */
  const createSuperAdmin = async () => {
    // SUPER_ADMIN 은 승격 API 로 부여할 수 없고, 어떤 테넌트에도 소속되지 않는다(멤버십 없음).
    await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        nickname: "platform-owner",
        password: await bcrypt.hash(password, 10),
        role: ROLES.SUPER_ADMIN,
      },
    });
    const session = request.agent(server());
    await session
      .post(`${V1_AUTH}/login`)
      .send({ email: SUPER_ADMIN_EMAIL, password })
      .expect(200);
    return session;
  };

  let tenantA: { id: string; subdomain: string };
  let tenantB: { id: string; subdomain: string };
  let adminA: ReturnType<typeof request.agent>;
  let superAdmin: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const a = await onboardTenant(TENANT_SUBDOMAINS[0], "owner-a@mgmt.test");
    const b = await onboardTenant(TENANT_SUBDOMAINS[1], "owner-b@mgmt.test");
    tenantA = a.tenant;
    tenantB = b.tenant;

    adminA = a.owner.session;
    superAdmin = await createSuperAdmin();
  });

  describe("X-Tenant-Id 스푸핑 차단 (job-032)", () => {
    it("TENANT_ADMIN 이 다른 테넌트 id 를 헤더로 실어 보내면 403", async () => {
      await adminA
        .get(`${V1_ADMIN}/users`)
        .set("X-Tenant-Id", tenantB.id)
        .expect(403);
    });

    it("자기 테넌트 id 를 헤더로 보내는 것은 정상 동작한다", async () => {
      const res = await adminA
        .get(`${V1_ADMIN}/users`)
        .set("X-Tenant-Id", tenantA.id)
        .expect(200);

      const emails = (res.body as UserListBody).data.items.map((u) => u.email);
      expect(emails).toContain("owner-a@mgmt.test");
      expect(emails).not.toContain("owner-b@mgmt.test");
    });

    // job-033: JWT 가 더 이상 tenantId 를 담지 않는다. 헤더/서브도메인이 없으면 활성 테넌트가
    // 없는 "개인 스코프"이고, 실효 역할이 USER 라 관리자 라우트는 막힌다.
    it("헤더 없이 호출하면 테넌트 컨텍스트가 없어 관리자 라우트가 403", async () => {
      await adminA.get(`${V1_ADMIN}/users`).expect(403);
    });

    it("SUPER_ADMIN 은 헤더로 임의 테넌트로 전환할 수 있다 (테넌트 스위처)", async () => {
      const res = await superAdmin
        .get(`${V1_ADMIN}/users`)
        .set("X-Tenant-Id", tenantB.id)
        .expect(200);

      const emails = (res.body as UserListBody).data.items.map((u) => u.email);
      expect(emails).toContain("owner-b@mgmt.test");
      expect(emails).not.toContain("owner-a@mgmt.test");
    });
  });

  describe("테넌트 목록/상세 (SUPER_ADMIN 전용)", () => {
    it("TENANT_ADMIN 은 테넌트 목록에 접근할 수 없다 (403)", async () => {
      await adminA.get(V1_TENANTS).expect(403);
    });

    it("미인증 요청도 차단된다 (401)", async () => {
      await request(server()).get(V1_TENANTS).expect(401);
    });

    it("SUPER_ADMIN 은 전체 테넌트를 소속 인원 수와 함께 조회한다", async () => {
      const res = await superAdmin.get(V1_TENANTS).expect(200);

      const body = (res.body as TenantListBody).data;
      const subdomains = body.items.map((t) => t.subdomain);
      expect(subdomains).toEqual(
        expect.arrayContaining([tenantA.subdomain, tenantB.subdomain]),
      );

      const a = body.items.find((t) => t.id === tenantA.id);
      // 온보딩으로 만들어진 초기 TENANT_ADMIN 멤버십 1건
      expect(a?._count.memberships).toBe(1);
      expect(a?._count.pets).toBe(0);
    });

    it("검색어로 테넌트를 필터링한다", async () => {
      const res = await superAdmin
        .get(V1_TENANTS)
        .query({ search: tenantB.subdomain })
        .expect(200);

      const items = (res.body as TenantListBody).data.items;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(tenantB.id);
    });

    it("SUPER_ADMIN 은 테넌트 상세를 조회한다", async () => {
      const res = await superAdmin
        .get(`${V1_TENANTS}/${tenantA.id}`)
        .expect(200);

      expect((res.body as TenantDetailBody).data.id).toBe(tenantA.id);
    });

    it("존재하지 않는 테넌트 상세는 404", async () => {
      await superAdmin
        .get(`${V1_TENANTS}/00000000-0000-4000-8000-000000000000`)
        .expect(404);
    });
  });

  describe("테넌트 정보 수정", () => {
    it("TENANT_ADMIN 은 테넌트를 수정할 수 없다 (403)", async () => {
      await adminA
        .patch(`${V1_TENANTS}/${tenantA.id}`)
        .send({ name: "탈취 시도" })
        .expect(403);
    });

    it("SUPER_ADMIN 은 이름을 수정한다", async () => {
      const res = await superAdmin
        .patch(`${V1_TENANTS}/${tenantA.id}`)
        .send({ name: "이름 변경됨" })
        .expect(200);

      expect((res.body as UpdateTenantBody).data.tenant.name).toBe(
        "이름 변경됨",
      );
    });

    it("이미 사용 중인 서브도메인으로는 변경할 수 없다 (409)", async () => {
      await superAdmin
        .patch(`${V1_TENANTS}/${tenantA.id}`)
        .send({ subdomain: tenantB.subdomain })
        .expect(409);
    });

    it("예약어 서브도메인은 거부된다 (400)", async () => {
      await superAdmin
        .patch(`${V1_TENANTS}/${tenantA.id}`)
        .send({ subdomain: "admin" })
        .expect(400);
    });

    it("서브도메인 변경이 반영된다", async () => {
      const res = await superAdmin
        .patch(`${V1_TENANTS}/${tenantA.id}`)
        .send({ subdomain: TENANT_SUBDOMAINS[2] })
        .expect(200);

      expect((res.body as UpdateTenantBody).data.tenant.subdomain).toBe(
        TENANT_SUBDOMAINS[2],
      );

      // 원복 — 이후 테스트가 tenantA.subdomain 을 그대로 쓰도록.
      await superAdmin
        .patch(`${V1_TENANTS}/${tenantA.id}`)
        .send({ subdomain: tenantA.subdomain })
        .expect(200);
    });
  });

  describe("테넌트 정지/재개", () => {
    it("TENANT_ADMIN 은 정지시킬 수 없다 (403)", async () => {
      await adminA
        .patch(`${V1_TENANTS}/${tenantB.id}/active`)
        .send({ isActive: false })
        .expect(403);
    });

    it("SUPER_ADMIN 이 정지시키면 해당 테넌트의 요청이 403 으로 막힌다", async () => {
      const res = await superAdmin
        .patch(`${V1_TENANTS}/${tenantA.id}/active`)
        .send({ isActive: false })
        .expect(200);
      expect((res.body as ActiveBody).data.tenant.isActive).toBe(false);

      // 정지된 테넌트 소속 관리자는 세션이 살아 있어도 차단된다.
      // (X-Tenant-Id 를 붙여 "테넌트 컨텍스트 없음"이 아니라 정지 때문임을 분명히 한다)
      await adminA
        .get(`${V1_ADMIN}/users`)
        .set("X-Tenant-Id", tenantA.id)
        .expect(403);
    });

    it("정지된 테넌트여도 SUPER_ADMIN 은 계속 접근할 수 있다", async () => {
      // 여기서 막히면 정지 직후 SUPER_ADMIN 이 스스로 잠겨 되돌릴 수 없게 된다.
      await superAdmin
        .get(`${V1_ADMIN}/users`)
        .set("X-Tenant-Id", tenantA.id)
        .expect(200);
    });

    it("재개하면 원래대로 접근된다", async () => {
      await superAdmin
        .patch(`${V1_TENANTS}/${tenantA.id}/active`)
        .send({ isActive: true })
        .expect(200);

      await adminA
        .get(`${V1_ADMIN}/users`)
        .set("X-Tenant-Id", tenantA.id)
        .expect(200);
    });
  });
});
