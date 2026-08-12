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
const V1_ATTENDANCES = `${PREFIX}/v1/attendances`;

const password = "password1234";

type AttendanceBody = {
  result: boolean;
  message: string;
  data: {
    attendance: {
      id: string;
      petId: string;
      status: string;
      checkInAt: string | null;
      checkOutAt: string | null;
    };
  };
};

describe("Attendance (e2e) — 출석 등/하원", () => {
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

    await cleanupAll();
    // 이 스펙이 사용할 매장 하나를 실제 온보딩 경로로 만든다(개설권 지급 포함).
    const tenantOwner = await newSignupAndLogin(server(), {
      email: "attn-tenant-owner@example.com",
      nickname: "attn-tenant-owner",
    });
    tenantId = (
      await openTenant(tenantOwner, {
        name: "attn-tenant",
        subdomain: "attn-tenant",
      })
    ).id;

    await prisma.subscriptionLedger.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.subscriptionLedger.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
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

  describe("등원(check-in) → 하원(check-out) 플로우 (ADMIN 전용)", () => {
    it("ADMIN 이 출석 기록을 생성하고 등원/하원 처리하면 상태·시각·정기권 차감 내역이 반영된다", async () => {
      const { owner, petId } = await createGuardianWithPet(server(), tenantId, {
        email: "attn-owner@example.com",
        nickname: "attn-owner",
        petName: "출석이",
      });
      const ownerId = owner.userId;

      const adminSession = await signupAndLoginAsAdmin(
        "attn-admin@example.com",
        "attn-admin",
      );

      const createRes = await adminSession
        .post(V1_ATTENDANCES)
        .send({ petId, date: "2026-07-30" })
        .expect(201);
      const attendanceId = (createRes.body as AttendanceBody).data.attendance
        .id;
      expect((createRes.body as AttendanceBody).data.attendance.status).toBe(
        "SCHEDULED",
      );

      const checkInRes = await adminSession
        .post(`${V1_ATTENDANCES}/${attendanceId}/check-in`)
        .send({})
        .expect(200);
      const checkedIn = (checkInRes.body as AttendanceBody).data.attendance;
      expect(checkedIn.status).toBe("CHECKED_IN");
      expect(checkedIn.checkInAt).not.toBeNull();

      const checkOutRes = await adminSession
        .post(`${V1_ATTENDANCES}/${attendanceId}/check-out`)
        .send({})
        .expect(200);
      const checkedOut = (checkOutRes.body as AttendanceBody).data.attendance;
      expect(checkedOut.status).toBe("CHECKED_OUT");
      expect(checkedOut.checkOutAt).not.toBeNull();

      // 등원 체크 시 기본값(deductSubscription=true)에 따라 정기권/회수권 차감 원장이 남는다
      // (활성 구독이 없으므로 -1 로 차감되어 기록됨).
      const ledger = await prisma.subscriptionLedger.findUnique({
        where: { attendanceId },
      });
      expect(ledger?.userId).toBe(ownerId);
      expect(ledger?.type).toBe("USE");
      expect(ledger?.amount).toBe(-1);
    });

    it("존재하지 않는 출석 기록에 등원 처리를 시도하면 404", async () => {
      const adminSession = await signupAndLoginAsAdmin(
        "attn-admin-404@example.com",
        "attn-admin-404",
      );
      await adminSession
        .post(`${V1_ATTENDANCES}/00000000-0000-0000-0000-000000000000/check-in`)
        .send({})
        .expect(404);
    });
  });

  describe("접근 제어", () => {
    it("인증 없이 요청하면 401", async () => {
      await request(server()).get(V1_ATTENDANCES).expect(401);
    });

    it("USER 역할은 403 (ADMIN 전용)", async () => {
      const userSession = await signupAndLogin(
        "attn-user-role@example.com",
        "attn-user-role",
      );
      await userSession
        .post(V1_ATTENDANCES)
        .send({
          petId: "00000000-0000-0000-0000-000000000000",
          date: "2026-07-30",
        })
        .expect(403);
    });
  });
});
