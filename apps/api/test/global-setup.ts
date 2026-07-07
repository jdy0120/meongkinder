import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

/**
 * e2e 글로벌 셋업 (jest 실행당 1회).
 *  1. .env.test 로드 (DATABASE_URL 등)
 *  2. 테스트 postgres/redis 컨테이너 기동 (healthy 될 때까지 대기)
 *  3. prisma 스키마를 테스트 DB 에 동기화
 *
 * 워커(테스트 파일)의 env 는 setupFiles(setup-env.ts)가 .env.test 로 다시 채우므로,
 * 여기서 설정한 값에 의존하지 않는다.
 */
export default function globalSetup(): void {
  const root = resolve(__dirname, "../../..");
  const compose = `${root}/ci/docker-composes/docker-compose.test.yaml`;

  config({ path: `${root}/envs/.env.test`, quiet: true });

  // 0. 안전 가드 — e2e 는 반드시 테스트 DB(template_test)만 대상으로. prisma db push
  //    와 deleteMany 가 운영/개발 DB 를 오염시키는 사고를 원천 차단.
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("template_test")) {
    throw new Error(
      `[e2e] 안전 가드 실패: DATABASE_URL 이 테스트 DB(template_test)가 아닙니다 → "${dbUrl}". 중단합니다.`,
    );
  }

  // 1. 테스트 인프라 기동
  execSync(`docker compose -f "${compose}" up -d --wait`, { stdio: "inherit" });

  // 2. 스키마 동기화 (DATABASE_URL 은 .env.test → 테스트 DB)
  execSync("pnpm --filter database db:push", {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
}
