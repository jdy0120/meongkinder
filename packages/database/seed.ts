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
    console.error(
      "❌ ADMIN_EMAIL / ADMIN_PASSWORD 환경변수가 필요합니다.",
    );
    process.exit(1);
  }

  await prismaConnect();

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" }, // 기존 계정이면 ADMIN 으로 승격
    create: { email, nickname, password: hashed, role: "ADMIN" },
  });

  console.log(`✅ 관리자 계정 준비 완료: ${user.email} (role=${user.role})`);

  await prismaDisconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prismaDisconnect();
  process.exit(1);
});
