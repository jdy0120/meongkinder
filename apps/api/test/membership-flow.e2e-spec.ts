import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, prismaConnect, prismaDisconnect } from "@pawlog/database";
import { MEMBERSHIP_STATUS, ROLES } from "@pawlog/shared";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  asTenant,
  cleanupAll,
  grantTenantEntitlement,
  openTenant,
  signupAndLogin,
  V1_INVITATIONS,
  V1_AUTH,
  V1_MEMBERSHIPS,
  V1_TENANTS,
  type SignedUpUser,
} from "./utils/tenant-setup";

const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_PETS = `${PREFIX}/v1/pets`;

type MembershipBody = {
  data: { membership: { id: string; status: string; role: string } };
};
type MembershipListBody = {
  data: { items: { id: string; status: string; userId: string }[] };
};
type MyMembershipsBody = {
  data: { memberships: { tenantId: string; status: string; role: string }[] };
};
type InvitationBody = {
  data: {
    invitation: { id: string; token: string; status: string };
    membership?: { id: string; status: string };
  };
};
type PetBody = { data: { pet: { id: string; tenantId: string | null } } };
type PetListBody = { data: { items: { id: string; name: string }[] } };
type TenantBody = { data: { tenant: { id: string } } };

describe("Membership Flow (e2e) — 구독→개설→초대→가입 매칭→등원", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

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
  });

  afterAll(async () => {
    await cleanupAll();
    await app.close();
    await prismaDisconnect();
  });

  // ── 1. 구독 기반 매장 개설 ────────────────────────────────────────────
  describe("매장 개설은 개설권 구독을 요구한다", () => {
    it("개설권이 없으면 온보딩이 403", async () => {
      const owner = await signupAndLogin(server(), {
        email: "no-seat@flow.test",
        nickname: "무개설권",
      });

      await owner.session
        .post(`${V1_TENANTS()}/onboard`)
        .send({ tenantName: "열리지 않는 매장", subdomain: "flow-nope" })
        .expect(403);

      expect(
        await prisma.tenant.findUnique({ where: { subdomain: "flow-nope" } }),
      ).toBeNull();
    });

    it("미인증 요청은 401 (예전에는 @Public 이라 누구나 만들 수 있었다)", async () => {
      await request(server())
        .post(`${V1_TENANTS()}/onboard`)
        .send({ tenantName: "익명 매장", subdomain: "flow-anon" })
        .expect(401);
    });

    it("개설권이 있으면 매장이 열리고 개설자가 TENANT_ADMIN 이 된다", async () => {
      const owner = await signupAndLogin(server(), {
        email: "seat-ok@flow.test",
        nickname: "사장님",
      });
      await grantTenantEntitlement(owner.userId);

      const res = await owner.session
        .post(`${V1_TENANTS()}/onboard`)
        .send({ tenantName: "정상 매장", subdomain: "flow-ok" })
        .expect(201);

      const tenantId = (res.body as TenantBody).data.tenant.id;

      const membership = await prisma.tenantMembership.findUniqueOrThrow({
        where: { userId_tenantId: { userId: owner.userId, tenantId } },
      });
      expect(membership.role).toBe(ROLES.TENANT_ADMIN);
      expect(membership.status).toBe(MEMBERSHIP_STATUS.ACTIVE);
    });

    it("개설권 1건으로 두 번째 매장은 열 수 없다 (구독 1건 = 매장 1개)", async () => {
      const owner = await signupAndLogin(server(), {
        email: "one-seat@flow.test",
        nickname: "1호점",
      });
      await grantTenantEntitlement(owner.userId);

      await owner.session
        .post(`${V1_TENANTS()}/onboard`)
        .send({ tenantName: "1호점", subdomain: "flow-store-1" })
        .expect(201);

      // 두 번째 시도 — 남은 개설권이 없다.
      await owner.session
        .post(`${V1_TENANTS()}/onboard`)
        .send({ tenantName: "2호점", subdomain: "flow-store-2" })
        .expect(403);

      // 개설권을 하나 더 사면 열린다.
      await grantTenantEntitlement(owner.userId);
      await owner.session
        .post(`${V1_TENANTS()}/onboard`)
        .send({ tenantName: "2호점", subdomain: "flow-store-2" })
        .expect(201);

      const used = await prisma.userSubscription.findMany({
        where: { userId: owner.userId, tenantId: { not: null } },
      });
      expect(used).toHaveLength(2);
    });
  });

  // ── 2. 보호자 가입 신청 → 승인 ────────────────────────────────────────
  describe("보호자 가입 신청과 승인", () => {
    let admin: SignedUpUser;
    let guardian: SignedUpUser;
    let tenantId: string;

    beforeAll(async () => {
      admin = await signupAndLogin(server(), {
        email: "apply-admin@flow.test",
        nickname: "관리자",
      });
      const tenant = await openTenant(admin, {
        name: "신청 테스트 매장",
        subdomain: "flow-apply",
      });
      tenantId = tenant.id;

      guardian = await signupAndLogin(server(), {
        email: "apply-guardian@flow.test",
        nickname: "보호자",
      });
    });

    it("신청하면 PENDING 상태로 접수된다", async () => {
      const res = await guardian.session
        .post(`${V1_MEMBERSHIPS()}/apply`)
        .send({ tenantId })
        .expect(201);

      expect((res.body as MembershipBody).data.membership.status).toBe(
        MEMBERSHIP_STATUS.PENDING,
      );
      expect((res.body as MembershipBody).data.membership.role).toBe(
        ROLES.GUARDIAN,
      );
    });

    it("중복 신청은 409", async () => {
      await guardian.session
        .post(`${V1_MEMBERSHIPS()}/apply`)
        .send({ tenantId })
        .expect(409);
    });

    it("승인 전에는 그 매장의 리소스에 접근할 수 없다 (403)", async () => {
      await asTenant(guardian.session, tenantId).get(V1_PETS).expect(403);
    });

    it("관리자가 승인 대기 목록에서 신청을 본다", async () => {
      const res = await asTenant(admin.session, tenantId)
        .get(V1_MEMBERSHIPS())
        .query({ status: MEMBERSHIP_STATUS.PENDING })
        .expect(200);

      const items = (res.body as MembershipListBody).data.items;
      expect(items).toHaveLength(1);
      expect(items[0].userId).toBe(guardian.userId);
    });

    it("승인하면 ACTIVE 가 되고 접근이 열린다", async () => {
      const membership = await prisma.tenantMembership.findUniqueOrThrow({
        where: {
          userId_tenantId: { userId: guardian.userId, tenantId },
        },
      });

      await asTenant(admin.session, tenantId)
        .patch(`${V1_MEMBERSHIPS()}/${membership.id}/decide`)
        .send({ status: MEMBERSHIP_STATUS.ACTIVE })
        .expect(200);

      await asTenant(guardian.session, tenantId).get(V1_PETS).expect(200);
    });

    it("보호자는 관리자 전용 라우트에는 여전히 접근할 수 없다", async () => {
      await asTenant(guardian.session, tenantId)
        .get(V1_MEMBERSHIPS())
        .expect(403);
    });

    it("내 소속 목록에 승인된 매장이 나온다", async () => {
      const res = await guardian.session
        .get(`${V1_MEMBERSHIPS()}/mine`)
        .expect(200);

      const memberships = (res.body as MyMembershipsBody).data.memberships;
      expect(memberships).toHaveLength(1);
      expect(memberships[0].tenantId).toBe(tenantId);
      expect(memberships[0].status).toBe(MEMBERSHIP_STATUS.ACTIVE);
    });
  });

  // ── 3. 초대 ───────────────────────────────────────────────────────────
  describe("초대 — 기존 회원", () => {
    let admin: SignedUpUser;
    let staff: SignedUpUser;
    let tenantId: string;

    beforeAll(async () => {
      admin = await signupAndLogin(server(), {
        email: "invite-admin@flow.test",
        nickname: "초대관리자",
      });
      const tenant = await openTenant(admin, {
        name: "초대 매장",
        subdomain: "flow-invite",
      });
      tenantId = tenant.id;

      staff = await signupAndLogin(server(), {
        email: "invite-staff@flow.test",
        nickname: "스태프",
      });
    });

    it("이미 회원이면 초대장 없이 곧바로 ACTIVE 멤버십이 만들어진다", async () => {
      const res = await asTenant(admin.session, tenantId)
        .post(V1_INVITATIONS())
        .send({ email: staff.email, role: ROLES.STAFF })
        .expect(201);

      const body = res.body as InvitationBody;
      expect(body.data.membership?.status).toBe(MEMBERSHIP_STATUS.ACTIVE);
      expect(body.data.invitation.status).toBe("ACCEPTED");
    });

    it("초대받은 스태프는 곧바로 출석 관리에 접근할 수 있다", async () => {
      await asTenant(staff.session, tenantId).get(V1_PETS).expect(200);
    });

    it("이메일과 전화번호를 모두 비우면 400", async () => {
      await asTenant(admin.session, tenantId)
        .post(V1_INVITATIONS())
        .send({ role: ROLES.GUARDIAN })
        .expect(400);
    });
  });

  describe("초대 — 미가입자 (초대 대체 자리표시자)", () => {
    let admin: SignedUpUser;
    let tenantId: string;

    beforeAll(async () => {
      admin = await signupAndLogin(server(), {
        email: "pre-admin@flow.test",
        nickname: "선등록관리자",
      });
      const tenant = await openTenant(admin, {
        name: "선등록 매장",
        subdomain: "flow-pre",
      });
      tenantId = tenant.id;
    });

    it("아직 회원이 아니면 연락처만 저장되고 멤버십은 생기지 않는다", async () => {
      const res = await asTenant(admin.session, tenantId)
        .post(V1_INVITATIONS())
        .send({ phone: "010-5555-6666" })
        .expect(201);

      const body = res.body as InvitationBody;
      expect(body.data.membership).toBeUndefined();
      expect(body.data.invitation.status).toBe("PENDING");

      // 전화번호는 숫자만 남기고 정규화되어야 매칭 키로 쓸 수 있다.
      const saved = await prisma.tenantInvitation.findUniqueOrThrow({
        where: { id: body.data.invitation.id },
      });
      expect(saved.phone).toBe("01055556666");
    });

    // job-058: 초대는 자격 부여 전용이므로 아이 정보 칸이 사라졌다.
    // 실어 보내면 조용히 무시되지 않고 400 이다(ValidationPipe forbidNonWhitelisted).
    it("아이 정보를 실어 보내면 거절된다", async () => {
      await asTenant(admin.session, tenantId)
        .post(V1_INVITATIONS())
        .send({ phone: "010-5555-7777", petName: "초코" })
        .expect(400);
    });

    it("같은 전화번호로 가입하면 자동으로 소속된다", async () => {
      // 하이픈 형태로 입력해도 정규화되어 매칭된다.
      const guardian = await signupAndLogin(server(), {
        email: "pre-guardian@flow.test",
        nickname: "선등록보호자",
        phone: "010-5555-6666",
      });

      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: { userId: guardian.userId, tenantId },
        },
      });
      expect(membership?.status).toBe(MEMBERSHIP_STATUS.ACTIVE);
      expect(membership?.role).toBe(ROLES.GUARDIAN);

      // 초대에 아이 정보가 없으므로 펫은 만들어지지 않는다 — 아이는 원생 등록
      // (`POST v1/admin/pets/intake`)이 맡는다.
      expect(
        await prisma.pet.findMany({ where: { userId: guardian.userId } }),
      ).toHaveLength(0);

      // 곧바로 그 매장의 보호자로 활동할 수 있다.
      await asTenant(guardian.session, tenantId).get(V1_PETS).expect(200);
    });

    // job-039: 카카오 로그인은 전화번호를 주지 않는다. 그래서 전화번호로 온 초대는
    // 회원이 나중에 "내 정보"에서 번호를 등록하는 시점에야 매칭될 수 있다.
    it("가입 후 전화번호를 등록하면 그때 초대가 매칭된다", async () => {
      await asTenant(admin.session, tenantId)
        .post(V1_INVITATIONS())
        .send({ phone: "010-7777-1111" })
        .expect(201);

      // 전화번호 없이 가입 (소셜 로그인과 같은 상황)
      const later = await signupAndLogin(server(), {
        email: "later-phone@flow.test",
        nickname: "나중가입",
      });

      // 아직 매칭되지 않았다.
      expect(
        await prisma.tenantMembership.findUnique({
          where: {
            userId_tenantId: { userId: later.userId, tenantId },
          },
        }),
      ).toBeNull();

      // 내 정보에서 전화번호를 등록하면 그 순간 소속된다.
      await later.session
        .patch(`${V1_AUTH()}/me`)
        .send({ phone: "010-7777-1111" })
        .expect(200);

      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: { userId: later.userId, tenantId },
        },
      });
      expect(membership?.status).toBe(MEMBERSHIP_STATUS.ACTIVE);
    });

    it("이메일로 선등록한 초대도 가입 시 매칭된다", async () => {
      await asTenant(admin.session, tenantId)
        .post(V1_INVITATIONS())
        .send({ email: "by-email@flow.test" })
        .expect(201);

      const guardian = await signupAndLogin(server(), {
        email: "by-email@flow.test",
        nickname: "이메일보호자",
      });

      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: { userId: guardian.userId, tenantId },
        },
      });
      expect(membership?.status).toBe(MEMBERSHIP_STATUS.ACTIVE);
    });
  });

  // ── 4. 펫 소유와 등원 ─────────────────────────────────────────────────
  describe("펫은 회원 소유, 등원은 별개", () => {
    let owner: SignedUpUser;
    let admin: SignedUpUser;
    let tenantId: string;
    let petId: string;

    beforeAll(async () => {
      admin = await signupAndLogin(server(), {
        email: "enroll-admin@flow.test",
        nickname: "등원관리자",
      });
      const tenant = await openTenant(admin, {
        name: "등원 매장",
        subdomain: "flow-enroll",
      });
      tenantId = tenant.id;

      owner = await signupAndLogin(server(), {
        email: "enroll-owner@flow.test",
        nickname: "펫주인",
      });
    });

    it("어느 매장에도 속하지 않은 회원이 자기 펫을 등록할 수 있다", async () => {
      const res = await owner.session
        .post(V1_PETS)
        .send({ name: "몽이", species: "DOG" })
        .expect(201);

      const pet = (res.body as PetBody).data.pet;
      petId = pet.id;
      expect(pet.tenantId).toBeNull(); // 아직 개인 펫
    });

    it("소속되지 않은 매장에는 등원할 수 없다 (403)", async () => {
      await owner.session
        .post(`${V1_PETS}/${petId}/enroll`)
        .send({ tenantId })
        .expect(403);
    });

    it("승인 대기 중에도 등원할 수 없다", async () => {
      await owner.session
        .post(`${V1_MEMBERSHIPS()}/apply`)
        .send({ tenantId })
        .expect(201);

      await owner.session
        .post(`${V1_PETS}/${petId}/enroll`)
        .send({ tenantId })
        .expect(403);
    });

    it("승인 후에는 등원할 수 있다", async () => {
      const membership = await prisma.tenantMembership.findUniqueOrThrow({
        where: { userId_tenantId: { userId: owner.userId, tenantId } },
      });
      await asTenant(admin.session, tenantId)
        .patch(`${V1_MEMBERSHIPS()}/${membership.id}/decide`)
        .send({ status: MEMBERSHIP_STATUS.ACTIVE })
        .expect(200);

      const res = await owner.session
        .post(`${V1_PETS}/${petId}/enroll`)
        .send({ tenantId })
        .expect(200);

      expect((res.body as PetBody).data.pet.tenantId).toBe(tenantId);
    });

    it("이미 등록된 아이는 중복 등원할 수 없다 (409)", async () => {
      await owner.session
        .post(`${V1_PETS}/${petId}/enroll`)
        .send({ tenantId })
        .expect(409);
    });

    it("등원해도 '내 펫' 목록에는 그대로 보인다 (개인 스코프)", async () => {
      const res = await owner.session.get(V1_PETS).expect(200);
      const items = (res.body as PetListBody).data.items;
      expect(items.map((p) => p.name)).toContain("몽이");
    });

    it("등원을 해지하면 개인 펫으로 돌아온다", async () => {
      const res = await owner.session
        .post(`${V1_PETS}/${petId}/unenroll`)
        .expect(200);
      expect((res.body as PetBody).data.pet.tenantId).toBeNull();
    });
  });

  // ── 5. 한 회원의 다중 소속 ────────────────────────────────────────────
  describe("한 회원이 여러 매장에 다른 자격으로 소속된다", () => {
    it("A 매장 관리자이면서 B 매장 보호자일 수 있고, 역할이 매장별로 다르게 적용된다", async () => {
      const person = await signupAndLogin(server(), {
        email: "multi@flow.test",
        nickname: "겸업",
      });

      // A 매장: 본인이 개설 → TENANT_ADMIN
      const tenantA = await openTenant(person, {
        name: "내 매장",
        subdomain: "flow-multi-a",
      });

      // B 매장: 남의 매장에 보호자로 신청 → 승인
      const otherAdmin = await signupAndLogin(server(), {
        email: "multi-other@flow.test",
        nickname: "다른사장",
      });
      const tenantB = await openTenant(otherAdmin, {
        name: "남의 매장",
        subdomain: "flow-multi-b",
      });

      await person.session
        .post(`${V1_MEMBERSHIPS()}/apply`)
        .send({ tenantId: tenantB.id })
        .expect(201);

      const membership = await prisma.tenantMembership.findUniqueOrThrow({
        where: {
          userId_tenantId: { userId: person.userId, tenantId: tenantB.id },
        },
      });
      await asTenant(otherAdmin.session, tenantB.id)
        .patch(`${V1_MEMBERSHIPS()}/${membership.id}/decide`)
        .send({ status: MEMBERSHIP_STATUS.ACTIVE })
        .expect(200);

      // A 에서는 관리자 라우트 통과
      await asTenant(person.session, tenantA.id)
        .get(V1_MEMBERSHIPS())
        .expect(200);

      // 같은 사람, 같은 토큰인데 B 에서는 보호자라 403
      await asTenant(person.session, tenantB.id)
        .get(V1_MEMBERSHIPS())
        .expect(403);

      // 내 소속 목록에는 두 매장이 모두 나온다
      const mine = await person.session
        .get(`${V1_MEMBERSHIPS()}/mine`)
        .expect(200);
      const tenantIds = (mine.body as MyMembershipsBody).data.memberships.map(
        (m) => m.tenantId,
      );
      expect(tenantIds).toEqual(
        expect.arrayContaining([tenantA.id, tenantB.id]),
      );
    });
  });

  // ── 6. 잠김 방지 ──────────────────────────────────────────────────────
  describe("마지막 관리자 보호", () => {
    it("매장에 관리자가 한 명뿐이면 탈퇴할 수 없다", async () => {
      const admin = await signupAndLogin(server(), {
        email: "solo-admin@flow.test",
        nickname: "유일관리자",
      });
      const tenant = await openTenant(admin, {
        name: "1인 매장",
        subdomain: "flow-solo",
      });

      const membership = await prisma.tenantMembership.findUniqueOrThrow({
        where: {
          userId_tenantId: { userId: admin.userId, tenantId: tenant.id },
        },
      });

      await admin.session
        .post(`${V1_MEMBERSHIPS()}/${membership.id}/leave`)
        .expect(403);
    });
  });
});
