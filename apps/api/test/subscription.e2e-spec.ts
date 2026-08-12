import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ROLES } from "@pawlog/shared";
import { prisma, prismaConnect, prismaDisconnect } from "@pawlog/database";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  asTenant,
  cleanupAll,
  createGuardianWithPet,
  grantMembership,
  openTenant,
  signupAndLogin as newSignupAndLogin,
} from "./utils/tenant-setup";

// setupApplication 이 붙이는 글로벌 프리픽스: api/${PROJECT_NAME}
const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_AUTH = `${PREFIX}/v1/auth`;
const V1_SUBSCRIPTIONS = `${PREFIX}/v1/subscriptions`;

const password = "password1234";

type PlanBody = { data: { plan: { id: string; name: string } } };
type MySubscriptionBody = {
  data: { subscription: unknown; billingKey: unknown };
};
type MyTicketsBody = { data: { tickets: unknown[] } };
type TicketListBody = {
  data: {
    tickets: {
      subscription: { id: string; pet: { name: string } | null };
      remainingCount: number | null;
    }[];
  };
};

describe("Subscription (e2e) — 구독/요금제 조회", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;
  let tenantId: string;

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

    // 정리를 먼저 끝낸 뒤 매장을 만든다 — 순서가 뒤바뀌면 방금 지급한 개설권/플랜을
    // 아래 deleteMany 가 지워버리고, userSubscription -> subscriptionPlan 의
    // ON DELETE RESTRICT 에 걸려 셋업이 멈춘다.
    await cleanupAll();
    await prisma.subscriptionPlan.deleteMany();

    // 이 스펙이 사용할 매장 하나를 실제 온보딩 경로로 만든다(개설권 지급 포함).
    const tenantOwner = await newSignupAndLogin(server(), {
      email: "sub-tenant-owner@example.com",
      nickname: "sub-tenant-owner",
    });
    tenantId = (
      await openTenant(tenantOwner, {
        name: "sub-tenant",
        subdomain: "sub-tenant",
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupAll();
    await prisma.subscriptionPlan.deleteMany();
    await app.close();
    await prismaDisconnect();
  });

  const signupAndLogin = async (email: string, nickname: string) => {
    const session = request.agent(server());
    await session
      .post(`${V1_AUTH}/signup`)
      .send({ email, password, nickname })
      .expect(201);
    await session
      .post(`${V1_AUTH}/login`)
      .send({ email, password })
      .expect(200);
    return session;
  };

  /**
   * job-033: 테넌트 역할은 User.role 이 아니라 멤버십이 갖는다.
   * 가입 후 현재 스펙의 테넌트에 TENANT_ADMIN 멤버십을 부여하고,
   * 테넌트 스코프 호출이 되도록 X-Tenant-Id 를 실어 보내는 래퍼를 돌려준다.
   */
  const signupAndLoginAsAdmin = async (email: string, nickname: string) => {
    const user = await newSignupAndLogin(server(), { email, nickname });
    await grantMembership(user.userId, tenantId, ROLES.TENANT_ADMIN);
    return asTenant(user.session, tenantId);
  };

  describe("요금제 목록 조회", () => {
    it("공개 목록(GET plans)은 비로그인으로 조회 가능하며, 활성 요금제만 노출된다", async () => {
      const adminSession = await signupAndLoginAsAdmin(
        "sub-admin@example.com",
        "sub-admin",
      );

      const createRes = await adminSession
        .post(`${V1_SUBSCRIPTIONS}/plans`)
        .send({
          name: "10회권",
          price: 100000,
          interval: "MONTHLY",
          planType: "COUNT",
          totalCount: 10,
          validityDays: 90,
        })
        .expect(201);
      const planId = (createRes.body as PlanBody).data.plan.id;

      const publicRes = await request(server())
        .get(`${V1_SUBSCRIPTIONS}/plans`)
        .expect(200);
      const plans = (publicRes.body as { data: { id: string }[] }).data;
      expect(plans.some((p) => p.id === planId)).toBe(true);
    });

    it("전체 목록(plans/all)은 ADMIN 전용이며 USER 는 403", async () => {
      const userSession = await signupAndLogin(
        "sub-user-role@example.com",
        "sub-user-role",
      );
      await userSession.get(`${V1_SUBSCRIPTIONS}/plans/all`).expect(403);
    });
  });

  describe("나의 구독/정기권 조회 — 구독 이력이 없는 사용자", () => {
    it("mine: 구독이 없으면 null 로 응답한다 (에러 없음)", async () => {
      const userSession = await signupAndLogin(
        "sub-mine@example.com",
        "sub-mine",
      );
      const res = await userSession.get(`${V1_SUBSCRIPTIONS}/mine`).expect(200);
      const body = (res.body as MySubscriptionBody).data;
      expect(body.subscription).toBeNull();
      expect(body.billingKey).toBeNull();
    });

    it("my-tickets: 구독이 없으면 빈 배열로 응답한다", async () => {
      const userSession = await signupAndLogin(
        "sub-tickets@example.com",
        "sub-tickets",
      );
      const res = await userSession
        .get(`${V1_SUBSCRIPTIONS}/my-tickets`)
        .expect(200);
      expect((res.body as MyTicketsBody).data.tickets).toEqual([]);
    });

    it("usage-history: 존재하지 않는 구독 id 는 404", async () => {
      const userSession = await signupAndLogin(
        "sub-usage@example.com",
        "sub-usage",
      );
      await userSession
        .get(
          `${V1_SUBSCRIPTIONS}/00000000-0000-0000-0000-000000000000/usage-history`,
        )
        .expect(404);
    });

    it("인증 없이 mine 을 요청하면 401", async () => {
      await request(server()).get(`${V1_SUBSCRIPTIONS}/mine`).expect(401);
    });
  });

  /**
   * job-055 회귀 방지.
   *
   * `getMyTickets(_userId)` 가 userId 를 쓰지 않고 `where` 없이 전체를 읽고 있었다.
   * 이 화면은 매장 게이트 바깥이라 활성 테넌트가 없고, 테넌트 스코프 익스텐션은 tenantId 가
   * 없으면 주입을 건너뛴다 — 그래서 필터가 하나도 걸리지 않아 **모든 매장의 이용권이 아무
   * 계정에나** 내려갔다. 아래 세 테스트가 각각 그 세 층(계정 없음 / 남의 아이 / 사용 내역)이다.
   */
  describe("나의 정기권은 내 아이 것만 (job-055)", () => {
    let guardianA: Awaited<ReturnType<typeof createGuardianWithPet>>;
    let guardianB: Awaited<ReturnType<typeof createGuardianWithPet>>;
    let subscriptionAId: string;

    beforeAll(async () => {
      guardianA = await createGuardianWithPet(server(), tenantId, {
        email: "sub-guardian-a@example.com",
        nickname: "보호자A",
        petName: "초코",
      });
      guardianB = await createGuardianWithPet(server(), tenantId, {
        email: "sub-guardian-b@example.com",
        nickname: "보호자B",
        petName: "두부",
      });

      const plan = await prisma.subscriptionPlan.create({
        data: {
          name: "10회권(티켓테스트)",
          price: 100000,
          interval: "MONTHLY",
          planType: "COUNT",
          totalCount: 10,
          validityDays: 90,
          scope: "TENANT",
          tenantId,
        },
      });

      const now = new Date();
      const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const subscription = await prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          petId: guardianA.petId,
          status: "ACTIVE",
          startDate: now,
          endDate: later,
          nextPaymentDate: later,
        },
      });
      subscriptionAId = subscription.id;

      await prisma.subscriptionLedger.create({
        data: {
          tenantId,
          petId: guardianA.petId,
          subscriptionId: subscription.id,
          type: "CHARGE",
          amount: 10,
          balanceAfter: 10,
        },
      });
    });

    it("아이가 없는 계정에는 아무것도 보이지 않는다 — 예전엔 전체가 내려왔다", async () => {
      const stranger = await signupAndLogin(
        "sub-stranger@example.com",
        "무관한회원",
      );
      const res = await stranger
        .get(`${V1_SUBSCRIPTIONS}/my-tickets`)
        .expect(200);
      expect((res.body as MyTicketsBody).data.tickets).toEqual([]);
    });

    it("본인 아이의 이용권만 보이고, 어느 아이 것인지가 함께 온다", async () => {
      const res = await guardianA.owner.session
        .get(`${V1_SUBSCRIPTIONS}/my-tickets`)
        .expect(200);

      const tickets = (res.body as TicketListBody).data.tickets;
      expect(tickets).toHaveLength(1);
      expect(tickets[0].subscription.id).toBe(subscriptionAId);
      // 형제견 구분용 — 카드에 아이 이름이 나와야 한다.
      expect(tickets[0].subscription.pet?.name).toBe("초코");
      expect(tickets[0].remainingCount).toBe(10);
    });

    it("같은 매장의 다른 보호자에게는 보이지 않는다", async () => {
      const res = await guardianB.owner.session
        .get(`${V1_SUBSCRIPTIONS}/my-tickets`)
        .expect(200);
      expect((res.body as MyTicketsBody).data.tickets).toEqual([]);
    });

    it("매장 컨텍스트를 실어도 결과가 같다 — 두 유치원에 맡겨도 한 화면에서 본다", async () => {
      const res = await asTenant(guardianA.owner.session, tenantId)
        .get(`${V1_SUBSCRIPTIONS}/my-tickets`)
        .expect(200);
      expect((res.body as MyTicketsBody).data.tickets).toHaveLength(1);
    });

    it("사용 내역은 본인 아이의 것만 열린다 (남의 id 는 404)", async () => {
      await guardianA.owner.session
        .get(`${V1_SUBSCRIPTIONS}/${subscriptionAId}/usage-history`)
        .expect(200);

      await guardianB.owner.session
        .get(`${V1_SUBSCRIPTIONS}/${subscriptionAId}/usage-history`)
        .expect(404);
    });
  });
});
