import "dotenv/config";
import * as bcrypt from "bcryptjs";
import { prisma, prismaConnect, prismaDisconnect } from "./index";

/**
 * 최초 관리자 부트스트랩.
 * ADMIN 전용 API 만으로는 첫 관리자를 만들 수 없으므로(닭·달걀),
 * 환경변수로 최초 1명을 생성/승격한다. 멱등하게 동작한다.
 *
 * 실행: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter database db:seed
 */
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const nickname = process.env.ADMIN_NICKNAME || "admin";

  if (!email || !password) {
    console.error("❌ ADMIN_EMAIL / ADMIN_PASSWORD 환경변수가 필요합니다.");
    process.exit(1);
  }

  await prismaConnect();

  // 기본 구독 플랜 2종 생성 (BASIC, PREMIUM)
  const plans = [
    {
      id: "plan-basic",
      name: "BASIC 요금제",
      price: 9900,
      interval: "MONTHLY",
      description: "기본적인 서비스를 제공하는 베이직 요금제입니다.",
    },
    {
      id: "plan-premium",
      name: "PREMIUM 요금제",
      price: 29900,
      interval: "MONTHLY",
      description: "모든 혜택을 제한 없이 제공하는 프리미엄 요금제입니다.",
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
      content: "서비스 이용약관 본문입니다. 서비스를 이용하시려면 이 약관에 동의하셔야 합니다.",
      isRequired: true,
      isActive: true,
    },
    {
      id: "terms-privacy",
      title: "개인정보 수집 및 이용 동의",
      type: "PRIVACY_POLICY",
      version: "1.0.0",
      content: "개인정보 수집 및 이용 동의 본문입니다. 서비스를 이용하시려면 개인정보 수집에 동의하셔야 합니다.",
      isRequired: true,
      isActive: true,
    },
    {
      id: "terms-marketing",
      title: "마케팅 정보 수신 동의",
      type: "MARKETING_RECEIPT",
      version: "1.0.0",
      content: "마케팅 정보 수신 동의 본문입니다. 이벤트 및 혜택 정보를 받아보실 수 있습니다.",
      isRequired: false,
      isActive: true,
    },
  ];

  for (const terms of termsList) {
    await prisma.terms.upsert({
      where: { id: terms.id },
      update: {
        title: terms.title,
        type: terms.type,
        version: terms.version,
        content: terms.content,
        isRequired: terms.isRequired,
        isActive: terms.isActive,
      },
      create: terms,
    });
  }
  console.log("✅ 기본 약관 시드 생성 완료");

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" }, // 기존 계정이면 ADMIN 으로 승격
    create: { email, nickname, password: hashed, role: "ADMIN" },
  });

  console.log(`✅ 관리자 계정 준비 완료: ${user.email} (role=${user.role})`);

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

  // 테스트용 어드민 구독 추가 (멱등성 확보)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  await prisma.userSubscription.upsert({
    where: {
      id: "admin-subscription-test-id",
    },
    update: {
      status: "ACTIVE",
      startDate,
      endDate,
      nextPaymentDate: endDate,
    },
    create: {
      id: "admin-subscription-test-id",
      userId: user.id,
      planId: "plan-premium",
      status: "ACTIVE",
      startDate,
      endDate,
      nextPaymentDate: endDate,
    },
  });
  console.log(`✅ 테스트용 어드민 구독 정보 연동 완료`);

  await prismaDisconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prismaDisconnect();
  process.exit(1);
});
