import "dotenv/config";
import * as bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { prisma, prismaConnect, prismaDisconnect } from "./index";

/**
 * 최초 관리자 부트스트랩.
 * ADMIN 전용 API 만으로는 첫 관리자를 만들 수 없으므로(닭·달걀),
 * 환경변수로 최초 1명을 생성/승격한다. 멱등하게 동작한다.
 *
 * 실행: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter database db:seed
 */
// job-020: 멀티테넌트 전환 백필과 동일한 default-tenant 를 가리키는 고정 UUID.
// (packages/database/prisma/migrations/20260730070000_backfill_default_tenant 참고)
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const nickname = process.env.ADMIN_NICKNAME || "admin";

  if (!email || !password) {
    console.error("❌ ADMIN_EMAIL / ADMIN_PASSWORD 환경변수가 필요합니다.");
    process.exit(1);
  }

  await prismaConnect();

  // 최초 테넌트(default-tenant) 시드
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: "default" },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      name: "Default Tenant",
      subdomain: "default",
    },
  });
  console.log(`✅ 기본 테넌트 준비 완료: ${tenant.subdomain} (${tenant.id})`);

  // 기본 요금제 시드.
  //
  // job-034: scope 로 두 상품이 구분된다 — TENANT(보호자가 유치원에 내는 원생 이용권) vs
  // PLATFORM(원장이 pawlog 에 내는 매장 개설권). 개설권이 없으면 온보딩 자체가 막히므로
  // PLATFORM 플랜이 최소 1개는 시드되어야 로컬에서 매장을 열 수 있다.
  //
  // job-051: 여기에 두 가지가 더해졌다.
  //   1) TENANT 요금제는 **유치원 소유**다(`tenantId` 필수). 예전에는 주인이 없어서
  //      A유치원이 만든 요금제가 B유치원 목록에도 떴다.
  //   2) 예전 시드의 "BASIC 요금제 9,900원"/"PREMIUM 요금제 29,900원"은 이름만 보면
  //      SaaS 이용료처럼 읽히는데 scope 는 TENANT(= 보호자가 사는 원생 이용권)였다.
  //      두 상품의 구분을 흐리는 데이터라, id 는 유지한 채(기존 FK 보존) 실제 유치원이
  //      팔 법한 상품으로 바꿨다. 덤으로 일권/한달권 구분이 시드에서 바로 드러난다.
  const plans = [
    {
      id: "plan-basic",
      name: "10회권",
      price: 200000,
      interval: "MONTHLY",
      description: "등원 10회를 이용할 수 있는 회수권입니다. 유효기간 90일.",
      scope: "TENANT",
      planType: "COUNT",
      totalCount: 10,
      validityDays: 90,
      tenantId: tenant.id,
    },
    {
      id: "plan-premium",
      name: "월 무제한",
      price: 350000,
      interval: "MONTHLY",
      description: "한 달 동안 횟수 제한 없이 등원할 수 있습니다.",
      scope: "TENANT",
      planType: "UNLIMITED",
      totalCount: null,
      validityDays: 30,
      tenantId: tenant.id,
    },
    {
      id: "plan-day-pass",
      name: "1일권",
      price: 25000,
      interval: "MONTHLY",
      description: "하루만 맡기는 단기 이용권입니다.",
      scope: "TENANT",
      planType: "PERIOD",
      totalCount: 1,
      validityDays: 1,
      tenantId: tenant.id,
    },
    {
      id: "plan-tenant-seat",
      name: "매장 개설 요금제",
      price: 49900,
      interval: "MONTHLY",
      description: "매장(유치원) 1개를 개설·운영할 수 있는 구독입니다.",
      scope: "PLATFORM",
      planType: "RECURRING",
      totalCount: null,
      validityDays: null,
      // 개설권은 pawlog 가 파는 상품이라 주인이 없다. DB CHECK 제약이 이 조합을 강제한다.
      tenantId: null,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        price: plan.price,
        interval: plan.interval,
        description: plan.description,
        scope: plan.scope,
        planType: plan.planType,
        totalCount: plan.totalCount,
        validityDays: plan.validityDays,
        tenantId: plan.tenantId,
      },
      create: plan,
    });
  }
  console.log("✅ 구독 플랜 시드 생성 완료");

  // 기본 약관 3종 생성 (이용약관, 개인정보, 마케팅동의)
  const termsList = [
    {
      id: "terms-service",
      title: "서비스 이용약관",
      type: "SERVICE_USE",
      version: "1.0.0",
      fileName: "terms-service.txt",
      content:
        "서비스 이용약관 본문입니다. 서비스를 이용하시려면 이 약관에 동의하셔야 합니다.",
      isRequired: true,
      isActive: true,
    },
    {
      id: "terms-privacy",
      title: "개인정보 수집 및 이용 동의",
      type: "PRIVACY_POLICY",
      version: "1.0.0",
      fileName: "terms-privacy.txt",
      content:
        "개인정보 수집 및 이용 동의 본문입니다. 서비스를 이용하시려면 개인정보 수집에 동의하셔야 합니다.",
      isRequired: true,
      isActive: true,
    },
    {
      id: "terms-marketing",
      title: "마케팅 정보 수신 동의",
      type: "MARKETING_RECEIPT",
      version: "1.0.0",
      fileName: "terms-marketing.txt",
      content:
        "마케팅 정보 수신 동의 본문입니다. 이벤트 및 혜택 정보를 받아보실 수 있습니다.",
      isRequired: false,
      isActive: true,
    },
  ];

  for (const terms of termsList) {
    const fileId = `file-${terms.id}`;
    const relativePath = `resources/uploads/terms/${terms.type}/${terms.version}/${terms.fileName}`;
    const absolutePath = path.join(__dirname, "../../apps/api", relativePath);

    // 1. 실제 파일 디렉토리 및 파일 생성
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, terms.content, "utf8");

    // 2. File 레코드 생성/갱신
    await prisma.file.upsert({
      where: { id: fileId },
      update: {
        originalName: terms.fileName,
        extension: path.extname(terms.fileName),
        mimeType: "text/plain",
        sizeByte: BigInt(Buffer.byteLength(terms.content)),
        localPath: relativePath,
        storageStatus: "LOCAL",
      },
      create: {
        id: fileId,
        tenantId: tenant.id,
        originalName: terms.fileName,
        extension: path.extname(terms.fileName),
        mimeType: "text/plain",
        sizeByte: BigInt(Buffer.byteLength(terms.content)),
        localPath: relativePath,
        storageStatus: "LOCAL",
      },
    });

    // 3. Terms 레코드 생성/갱신
    await prisma.terms.upsert({
      where: { id: terms.id },
      update: {
        title: terms.title,
        type: terms.type,
        version: terms.version,
        fileId: fileId,
        isRequired: terms.isRequired,
        isActive: terms.isActive,
      },
      create: {
        id: terms.id,
        title: terms.title,
        type: terms.type,
        version: terms.version,
        fileId: fileId,
        isRequired: terms.isRequired,
        isActive: terms.isActive,
      },
    });
  }
  console.log("✅ 기본 약관 및 파일 시드 생성 완료");

  // job-033: 회원은 플랫폼 전역 정체성(email 전역 유니크)이고, 테넌트 역할은 멤버십이 갖는다.
  //
  // 이 계정은 두 층의 역할을 모두 갖는다 — 부트스트랩 계정이라 그렇다.
  //   · 플랫폼 레벨 SUPER_ADMIN  → apps/admin(플랫폼 운영 콘솔) 접근. 승격 API 가 SUPER_ADMIN 을
  //     부여하지 못하므로(닭·달걀) 여기서 심는 수밖에 없다.
  //   · default 테넌트의 TENANT_ADMIN → apps/web 의 `/default/…` 매장 화면을 로컬에서 열어보기 위함.
  //
  // 운영에서는 CLAUDE.md §5 대로 SUPER_ADMIN 이 어떤 테넌트에도 속하지 않는 게 정상이다.
  // 두 자격이 겹쳐도 RolesGuard 는 플랫폼 역할을 먼저 보고(roles.guard.ts:resolveEffectiveRole),
  // 플랫폼 콘솔의 조회 대상(User·Tenant·Terms)은 테넌트 스코프 모델이 아니라서
  // (tenant-scope.extension.ts:TENANT_SCOPED_MODELS) 활성 테넌트가 열려 있어도 결과가 좁혀지지 않는다.
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    // 기존 계정이면 플랫폼 운영자로 승격한다 (job-038 이전 시드는 USER 로 만들어졌다).
    update: { role: "SUPER_ADMIN" },
    create: {
      email,
      nickname,
      password: hashed,
      role: "SUPER_ADMIN",
    },
  });

  const membership = await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { role: "TENANT_ADMIN", status: "ACTIVE" },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: "TENANT_ADMIN",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });

  console.log(
    `✅ 관리자 계정 준비 완료: ${user.email} (플랫폼 ${user.role} · ${tenant.subdomain} 에서 ${membership.role})`,
  );

  // 테스트용 어드민의 약관 동의 이력 연동 (필수 약관 전체 및 마케팅 동의)
  for (const terms of termsList) {
    await prisma.userTermsAgreement.upsert({
      where: {
        id: `admin-agreement-${terms.id}`,
      },
      update: {
        isAgreed: true,
      },
      create: {
        id: `admin-agreement-${terms.id}`,
        userId: user.id,
        termsId: terms.id,
        isAgreed: true,
      },
    });
  }
  console.log(`✅ 테스트용 어드민 약관 동의 정보 연동 완료`);

  // 테스트용 테넌트 구독 추가 (멱등성 확보). job-020 부터 구독 주체가 User -> Tenant 로 이동.
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  await prisma.tenantSubscription.upsert({
    where: {
      id: "default-tenant-subscription-test-id",
    },
    update: {
      status: "ACTIVE",
      startDate,
      endDate,
      nextPaymentDate: endDate,
    },
    create: {
      id: "default-tenant-subscription-test-id",
      tenantId: tenant.id,
      planId: "plan-premium",
      status: "ACTIVE",
      startDate,
      endDate,
      nextPaymentDate: endDate,
    },
  });
  console.log(`✅ 테스트용 테넌트 구독 정보 연동 완료`);

  await prismaDisconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prismaDisconnect();
  process.exit(1);
});
