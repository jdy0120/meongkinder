import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, prismaConnect, prismaDisconnect } from "@pawlog/database";
import { MEMBERSHIP_STATUS, ROLES } from "@pawlog/shared";
import * as bcrypt from "bcryptjs";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  cleanupAll,
  grantMembership,
  grantTenantEntitlement,
  openTenant,
  signupAndLogin,
  TEST_PASSWORD,
  V1_AUTH,
  type SignedUpUser,
} from "./utils/tenant-setup";

const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_PLATFORM = `${PREFIX}/v1/platform`;

type UserListBody = {
  data: {
    items: {
      id: string;
      email: string;
      role: string;
      status: string;
      memberships: { role: string; tenant: { name: string } }[];
    }[];
    meta: { total: number };
  };
};
type UserBody = {
  data: { user: { id: string; role: string; status: string } };
};
type SeatListBody = {
  data: {
    items: { id: string; tenantId: string | null; user: { email: string } }[];
    meta: { total: number };
  };
};

describe("Platform (e2e) — SUPER_ADMIN 전 플랫폼 회원/구독 관리", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  const SUPER_ADMIN_EMAIL = "platform-admin@pawlog.test";

  let superAdmin: ReturnType<typeof request.agent>;
  let superAdminId: string;
  let ownerA: SignedUpUser;
  let tenantA: { id: string };
  let plainUser: SignedUpUser;

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

    // SUPER_ADMIN 은 승격 API 로 만들 수 없으므로 직접 심는다.
    const created = await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        nickname: "platform-admin",
        password: await bcrypt.hash(TEST_PASSWORD, 10),
        role: ROLES.SUPER_ADMIN,
      },
    });
    superAdminId = created.id;

    superAdmin = request.agent(server());
    await superAdmin
      .post(`${V1_AUTH()}/login`)
      .send({ email: SUPER_ADMIN_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    ownerA = await signupAndLogin(server(), {
      email: "platform-owner@pawlog.test",
      nickname: "매장주",
    });
    tenantA = await openTenant(ownerA, {
      name: "플랫폼테스트매장",
      subdomain: "platform-a",
    });

    plainUser = await signupAndLogin(server(), {
      email: "platform-plain@pawlog.test",
      nickname: "일반회원",
      phone: "010-9999-8888",
    });
  });

  afterAll(async () => {
    await cleanupAll();
    await app.close();
    await prismaDisconnect();
  });

  describe("접근 제어", () => {
    it("TENANT_ADMIN 은 플랫폼 회원 목록에 접근할 수 없다 (403)", async () => {
      await ownerA.session.get(`${V1_PLATFORM}/users`).expect(403);
    });

    it("일반 회원도 차단된다 (403)", async () => {
      await plainUser.session.get(`${V1_PLATFORM}/users`).expect(403);
    });

    it("미인증은 401", async () => {
      await request(server()).get(`${V1_PLATFORM}/users`).expect(401);
    });
  });

  describe("전 플랫폼 회원 목록", () => {
    it("테넌트를 가로질러 모든 회원이 보이고 소속이 함께 내려온다", async () => {
      const res = await superAdmin.get(`${V1_PLATFORM}/users`).expect(200);
      const items = (res.body as UserListBody).data.items;

      const emails = items.map((u) => u.email);
      expect(emails).toEqual(
        expect.arrayContaining([
          SUPER_ADMIN_EMAIL,
          ownerA.email,
          plainUser.email,
        ]),
      );

      const owner = items.find((u) => u.email === ownerA.email);
      expect(owner?.memberships[0].role).toBe(ROLES.TENANT_ADMIN);
      expect(owner?.memberships[0].tenant.name).toBe("플랫폼테스트매장");
    });

    it("활성 테넌트가 열려 있어도 결과가 좁아지지 않는다", async () => {
      // SUPER_ADMIN 이 매장 하나를 들여다보던 중에 이 화면으로 와도 전체가 보여야 한다.
      const res = await superAdmin
        .get(`${V1_PLATFORM}/users`)
        .set("X-Tenant-Id", tenantA.id)
        .expect(200);

      const emails = (res.body as UserListBody).data.items.map((u) => u.email);
      expect(emails).toContain(plainUser.email); // 이 매장 소속이 아닌 회원
    });

    it("전화번호로도 검색된다", async () => {
      const res = await superAdmin
        .get(`${V1_PLATFORM}/users`)
        .query({ search: "01099998888" })
        .expect(200);

      const items = (res.body as UserListBody).data.items;
      expect(items).toHaveLength(1);
      expect(items[0].email).toBe(plainUser.email);
    });

    it("역할로 필터링된다", async () => {
      const res = await superAdmin
        .get(`${V1_PLATFORM}/users`)
        .query({ role: ROLES.SUPER_ADMIN })
        .expect(200);

      const items = (res.body as UserListBody).data.items;
      expect(items).toHaveLength(1);
      expect(items[0].email).toBe(SUPER_ADMIN_EMAIL);
    });
  });

  describe("계정 정지 / 역할 변경", () => {
    it("계정을 정지시킬 수 있다", async () => {
      const res = await superAdmin
        .patch(`${V1_PLATFORM}/users/${plainUser.userId}/status`)
        .send({ status: "SUSPENDED" })
        .expect(200);

      expect((res.body as UserBody).data.user.status).toBe("SUSPENDED");
    });

    it("본인 계정은 정지시킬 수 없다 (400)", async () => {
      await superAdmin
        .patch(`${V1_PLATFORM}/users/${superAdminId}/status`)
        .send({ status: "SUSPENDED" })
        .expect(400);
    });

    it("SUPER_ADMIN 으로 승격할 수 있다", async () => {
      const res = await superAdmin
        .patch(`${V1_PLATFORM}/users/${plainUser.userId}/role`)
        .send({ role: ROLES.SUPER_ADMIN })
        .expect(200);

      expect((res.body as UserBody).data.user.role).toBe(ROLES.SUPER_ADMIN);
    });

    it("본인 역할은 변경할 수 없다 — 마지막 관리자 잠김 방지 (400)", async () => {
      await superAdmin
        .patch(`${V1_PLATFORM}/users/${superAdminId}/role`)
        .send({ role: ROLES.USER })
        .expect(400);
    });

    it("테넌트 역할은 이 API 로 부여할 수 없다 (400)", async () => {
      await superAdmin
        .patch(`${V1_PLATFORM}/users/${plainUser.userId}/role`)
        .send({ role: ROLES.TENANT_ADMIN })
        .expect(400);
    });
  });

  describe("계정 삭제", () => {
    it("매장의 마지막 관리자는 삭제할 수 없다 (409)", async () => {
      await superAdmin
        .delete(`${V1_PLATFORM}/users/${ownerA.userId}`)
        .expect(409);

      // 여전히 살아 있어야 한다.
      expect(
        await prisma.user.findUnique({ where: { id: ownerA.userId } }),
      ).not.toBeNull();
    });

    it("다른 관리자를 지정하면 삭제할 수 있다", async () => {
      const coAdmin = await signupAndLogin(server(), {
        email: "platform-coadmin@pawlog.test",
        nickname: "공동관리자",
      });
      await grantMembership(coAdmin.userId, tenantA.id, ROLES.TENANT_ADMIN);

      await superAdmin
        .delete(`${V1_PLATFORM}/users/${ownerA.userId}`)
        .expect(200);

      expect(
        await prisma.user.findUnique({ where: { id: ownerA.userId } }),
      ).toBeNull();
      // 소속도 함께 정리된다(Cascade).
      expect(
        await prisma.tenantMembership.findFirst({
          where: { userId: ownerA.userId },
        }),
      ).toBeNull();
    });

    it("본인 계정은 삭제할 수 없다 (400)", async () => {
      await superAdmin
        .delete(`${V1_PLATFORM}/users/${superAdminId}`)
        .expect(400);
    });
  });

  describe("전 플랫폼 개설권 구독 현황", () => {
    it("사용/미사용 개설권이 모두 보이고 사용처가 함께 내려온다", async () => {
      // 앞선 삭제 테스트가 계정을 지우면 그 계정의 개설권도 Cascade 로 사라지므로,
      // 이 테스트는 자기 데이터를 직접 만들어 다른 테스트에 의존하지 않는다.
      const buyer = await signupAndLogin(server(), {
        email: "platform-buyer@pawlog.test",
        nickname: "구매자",
      });
      await grantTenantEntitlement(buyer.userId); // 미사용 개설권 1건

      const storeOwner = await signupAndLogin(server(), {
        email: "platform-seat-owner@pawlog.test",
        nickname: "개설자",
      });
      await openTenant(storeOwner, {
        name: "개설권사용매장",
        subdomain: "platform-seat",
      });

      const res = await superAdmin
        .get(`${V1_PLATFORM}/subscriptions`)
        .expect(200);

      const items = (res.body as SeatListBody).data.items;

      const unused = items.find((s) => s.user.email === buyer.email);
      expect(unused?.tenantId).toBeNull();

      // 매장을 연 개설권은 tenantId 가 채워져 있다.
      const used = items.find((s) => s.user.email === storeOwner.email);
      expect(used?.tenantId).not.toBeNull();
    });

    it("TENANT_ADMIN 은 접근할 수 없다 (403)", async () => {
      const other = await signupAndLogin(server(), {
        email: "platform-other@pawlog.test",
        nickname: "다른매장주",
      });
      const tenant = await openTenant(other, {
        name: "다른매장",
        subdomain: "platform-b",
      });
      await grantMembership(other.userId, tenant.id, ROLES.TENANT_ADMIN);

      await other.session
        .get(`${V1_PLATFORM}/subscriptions`)
        .set("X-Tenant-Id", tenant.id)
        .expect(403);
    });
  });

  describe("멤버십 상태는 건드리지 않는다", () => {
    it("계정 정지는 소속(ACTIVE)을 바꾸지 않는다 — 복구 시 그대로 돌아와야 한다", async () => {
      const member = await signupAndLogin(server(), {
        email: "platform-member@pawlog.test",
        nickname: "구성원",
      });
      await grantMembership(member.userId, tenantA.id, ROLES.GUARDIAN);

      await superAdmin
        .patch(`${V1_PLATFORM}/users/${member.userId}/status`)
        .send({ status: "SUSPENDED" })
        .expect(200);

      const membership = await prisma.tenantMembership.findUniqueOrThrow({
        where: {
          userId_tenantId: { userId: member.userId, tenantId: tenantA.id },
        },
      });
      expect(membership.status).toBe(MEMBERSHIP_STATUS.ACTIVE);
    });
  });

  // 목록 총계를 검사하는 위 블록들보다 뒤에 둔다 — 여기서 회원이 늘어난다.
  describe("계정 발급", () => {
    const NEW_EMAIL = "platform-issued@pawlog.test";

    // 위 블록들이 plainUser 를 정지·승격시키고 ownerA 를 삭제하므로, 여기서 쓸 일반
    // 회원은 새로 만든다 — 앞 블록의 부작용에 기대면 순서만 바뀌어도 깨진다.
    let outsider: SignedUpUser;

    beforeAll(async () => {
      outsider = await signupAndLogin(server(), {
        email: "platform-outsider@pawlog.test",
        nickname: "권한없는회원",
      });
    });

    it("일반 회원은 계정을 발급할 수 없다 (403)", async () => {
      await outsider.session
        .post(`${V1_PLATFORM}/users`)
        .send({
          email: "nope@pawlog.test",
          password: TEST_PASSWORD,
          nickname: "안됨",
        })
        .expect(403);
    });

    it("이메일 형식·비밀번호 길이를 검증한다 (400)", async () => {
      await superAdmin
        .post(`${V1_PLATFORM}/users`)
        .send({ email: "not-an-email", password: TEST_PASSWORD, nickname: "n" })
        .expect(400);

      await superAdmin
        .post(`${V1_PLATFORM}/users`)
        .send({ email: "short@pawlog.test", password: "1234", nickname: "n" })
        .expect(400);
    });

    it("테넌트 역할은 이 API 로 부여할 수 없다 (400)", async () => {
      await superAdmin
        .post(`${V1_PLATFORM}/users`)
        .send({
          email: "tenant-role@pawlog.test",
          password: TEST_PASSWORD,
          nickname: "n",
          role: ROLES.TENANT_ADMIN,
        })
        .expect(400);
    });

    it("전화번호는 숫자만 저장되고, 약관 동의는 만들지 않는다", async () => {
      const res = await superAdmin
        .post(`${V1_PLATFORM}/users`)
        .send({
          email: NEW_EMAIL,
          password: TEST_PASSWORD,
          nickname: "발급된회원",
          phone: "010-7777-6666",
        })
        .expect(201);

      const { user } = (res.body as UserBody).data;
      const created = await prisma.user.findUniqueOrThrow({
        where: { email: NEW_EMAIL },
      });
      expect(created.phone).toBe("01077776666");
      expect(user.role).toBe(ROLES.USER);
      expect(user.status).toBe("ACTIVE");

      // 동의는 본인만 할 수 있다 — 대신 눌러주지 않고, 최초 진입 게이트가 받는다.
      const agreements = await prisma.userTermsAgreement.count({
        where: { userId: created.id },
      });
      expect(agreements).toBe(0);
    });

    it("같은 이메일로 두 번 발급할 수 없다 (409)", async () => {
      await superAdmin
        .post(`${V1_PLATFORM}/users`)
        .send({
          email: NEW_EMAIL,
          password: TEST_PASSWORD,
          nickname: "중복",
        })
        .expect(409);
    });

    it("발급된 계정으로 로그인된다", async () => {
      await request(server())
        .post(`${V1_AUTH()}/login`)
        .send({ email: NEW_EMAIL, password: TEST_PASSWORD })
        .expect(200);
    });

    it("SUPER_ADMIN 으로 발급하면 바로 플랫폼 API 를 쓸 수 있다", async () => {
      const email = "platform-issued-admin@pawlog.test";
      await superAdmin
        .post(`${V1_PLATFORM}/users`)
        .send({
          email,
          password: TEST_PASSWORD,
          nickname: "신규운영자",
          role: ROLES.SUPER_ADMIN,
        })
        .expect(201);

      const agent = request.agent(server());
      await agent
        .post(`${V1_AUTH()}/login`)
        .send({ email, password: TEST_PASSWORD })
        .expect(200);
      await agent.get(`${V1_PLATFORM}/users`).expect(200);
    });

    it("그 번호로 대기 중이던 초대가 발급과 동시에 소속 처리된다", async () => {
      const phone = "01055554444";
      await prisma.tenantInvitation.create({
        data: {
          tenantId: tenantA.id,
          phone,
          role: ROLES.GUARDIAN,
          token: "platform-issue-invite",
          // ownerA 는 위 "계정 삭제" 블록에서 지워졌다 — 살아 있는 계정을 초대자로 쓴다.
          invitedBy: superAdminId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const email = "platform-invited@pawlog.test";
      const res = await superAdmin
        .post(`${V1_PLATFORM}/users`)
        .send({
          email,
          password: TEST_PASSWORD,
          nickname: "초대받은사람",
          // 하이픈을 넣어 보내도 초대의 숫자열과 매칭되어야 한다 (job-043).
          phone: "010-5555-4444",
        })
        .expect(201);

      expect(
        (res.body as { data: { claimedInvitations: number } }).data
          .claimedInvitations,
      ).toBe(1);

      const created = await prisma.user.findUniqueOrThrow({ where: { email } });
      const membership = await prisma.tenantMembership.findUniqueOrThrow({
        where: {
          userId_tenantId: { userId: created.id, tenantId: tenantA.id },
        },
      });
      expect(membership.status).toBe(MEMBERSHIP_STATUS.ACTIVE);
    });
  });
});
