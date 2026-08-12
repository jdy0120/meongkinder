import type { Server } from "node:http";
import request from "supertest";
import { prisma } from "@pawlog/database";
import { MEMBERSHIP_STATUS, ROLES } from "@pawlog/shared";
import type { MembershipRole } from "@pawlog/shared";

/**
 * e2e 공용 테넌트 셋업 헬퍼 (job-033/034).
 *
 * 새 모델에서는 테넌트를 만들려면 "회원 가입 → 매장 개설권 구독 → 온보딩"을 거쳐야 하고,
 * 테넌트 리소스에 접근하려면 활성 테넌트(`X-Tenant-Id`)와 ACTIVE 멤버십이 모두 필요하다.
 * 스펙마다 이 과정을 반복하지 않도록 여기에 모았다.
 *
 * 결제(토스)는 TOSS_SECRET_KEY 가 없어 e2e 에서 탈 수 없다. 그래서 개설권(UserSubscription)은
 * Prisma 로 직접 심고, **게이팅 로직 자체**(개설권 없으면 403 / 있으면 소비 / 재사용 불가)는
 * 실제 API 로 검증한다.
 */

export const TEST_PASSWORD = "password1234";

const PLATFORM_PLAN_ID = "e2e-platform-plan";

export const prefix = (): string => `/api/${process.env.PROJECT_NAME}`;
export const V1_AUTH = (): string => `${prefix()}/v1/auth`;
export const V1_TENANTS = (): string => `${prefix()}/v1/tenants`;
export const V1_MEMBERSHIPS = (): string => `${prefix()}/v1/memberships`;
export const V1_INVITATIONS = (): string => `${prefix()}/v1/invitations`;

/** 매장 개설권 요금제를 준비한다 (없으면 만들고, 있으면 그대로 쓴다). */
export const seedPlatformPlan = async (): Promise<string> => {
  await prisma.subscriptionPlan.upsert({
    where: { id: PLATFORM_PLAN_ID },
    update: { isActive: true, scope: "PLATFORM" },
    create: {
      id: PLATFORM_PLAN_ID,
      name: "e2e 매장 개설권",
      price: 49900,
      interval: "MONTHLY",
      scope: "PLATFORM",
      isActive: true,
    },
  });
  return PLATFORM_PLAN_ID;
};

/**
 * 미사용 매장 개설권 1건을 직접 지급한다 (결제 우회).
 * 실제 운영에서는 POST v1/platform-subscriptions/subscribe 가 이 로우를 만든다.
 */
export const grantTenantEntitlement = async (userId: string) => {
  const planId = await seedPlatformPlan();
  const now = new Date();
  const later = new Date(now);
  later.setMonth(later.getMonth() + 1);

  return prisma.userSubscription.create({
    data: {
      userId,
      planId,
      status: "ACTIVE",
      startDate: now,
      endDate: later,
      nextPaymentDate: later,
      // tenantId 를 비워 둔 상태가 곧 "미사용 개설권"이다.
    },
  });
};

export interface SignedUpUser {
  session: ReturnType<typeof request.agent>;
  userId: string;
  email: string;
}

/** 회원가입 + 로그인. 새 모델에서 가입은 어떤 테넌트에도 속하지 않는다. */
export const signupAndLogin = async (
  server: Server,
  opts: { email: string; nickname: string; phone?: string },
): Promise<SignedUpUser> => {
  const session = request.agent(server);
  await session
    .post(`${V1_AUTH()}/signup`)
    .send({
      email: opts.email,
      password: TEST_PASSWORD,
      nickname: opts.nickname,
      ...(opts.phone ? { phone: opts.phone } : {}),
    })
    .expect(201);

  await session
    .post(`${V1_AUTH()}/login`)
    .send({ email: opts.email, password: TEST_PASSWORD })
    .expect(200);

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: opts.email },
  });

  return { session, userId: user.id, email: opts.email };
};

/**
 * 개설권을 지급하고 실제 온보딩 API 로 매장을 연다.
 * 호출자는 그 매장의 TENANT_ADMIN 이 된다.
 */
export const openTenant = async (
  user: SignedUpUser,
  opts: { name: string; subdomain: string },
): Promise<{ id: string; subdomain: string }> => {
  await grantTenantEntitlement(user.userId);

  const res = await user.session
    .post(`${V1_TENANTS()}/onboard`)
    .send({ tenantName: opts.name, subdomain: opts.subdomain })
    .expect(201);

  const body = res.body as { data: { tenant: { id: string } } };
  return { id: body.data.tenant.id, subdomain: opts.subdomain };
};

/** 임의 회원에게 특정 테넌트의 ACTIVE 멤버십을 직접 부여한다(승인 절차 우회). */
export const grantMembership = async (
  userId: string,
  tenantId: string,
  role: MembershipRole = ROLES.GUARDIAN,
) =>
  prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    update: { role, status: MEMBERSHIP_STATUS.ACTIVE, approvedAt: new Date() },
    create: {
      userId,
      tenantId,
      role,
      status: MEMBERSHIP_STATUS.ACTIVE,
      approvedAt: new Date(),
    },
  });

/**
 * 보호자 + 그 매장에 등원까지 마친 펫을 한 번에 준비한다.
 * 새 모델에서는 펫이 회원 소유로 만들어진 뒤(tenantId=null) 별도 등원으로 원생이 되므로,
 * 출석/리포트 스펙은 이 두 단계를 모두 거쳐야 한다.
 */
export const createGuardianWithPet = async (
  server: Server,
  tenantId: string,
  opts: { email: string; nickname: string; petName: string },
): Promise<{ owner: SignedUpUser; petId: string }> => {
  const owner = await signupAndLogin(server, {
    email: opts.email,
    nickname: opts.nickname,
  });
  await grantMembership(owner.userId, tenantId, ROLES.GUARDIAN);

  const petRes = await owner.session
    .post(`${prefix()}/v1/pets`)
    .send({ name: opts.petName, species: "DOG" })
    .expect(201);
  const petId = (petRes.body as { data: { pet: { id: string } } }).data.pet.id;

  await owner.session
    .post(`${prefix()}/v1/pets/${petId}/enroll`)
    .send({ tenantId })
    .expect(200);

  return { owner, petId };
};

/**
 * 특정 테넌트 컨텍스트로 요청을 보내는 래퍼.
 * 새 모델에서 테넌트 리소스는 `X-Tenant-Id` 없이는 개인 스코프로 처리되므로,
 * 테넌트 스코프 호출은 반드시 이 래퍼를 거친다.
 */
export const asTenant = (
  session: ReturnType<typeof request.agent>,
  tenantId: string,
) => ({
  get: (url: string) => session.get(url).set("X-Tenant-Id", tenantId),
  post: (url: string) => session.post(url).set("X-Tenant-Id", tenantId),
  patch: (url: string) => session.patch(url).set("X-Tenant-Id", tenantId),
  delete: (url: string) => session.delete(url).set("X-Tenant-Id", tenantId),
});

/** 스펙 간 간섭을 막는 공용 정리. 참조 순서대로 지운다. */
export const cleanupAll = async (): Promise<void> => {
  await prisma.reportContent.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.subscriptionLedger.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.file.deleteMany();
  await prisma.fileTemp.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.tenantInvitation.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.userSubscription.deleteMany();
  await prisma.userBillingKey.deleteMany();
  await prisma.tenantSubscription.deleteMany();
  await prisma.tenantBillingKey.deleteMany();
  await prisma.userTermsAgreement.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
};
