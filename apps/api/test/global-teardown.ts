import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * e2e 글로벌 정리 — 테스트 컨테이너를 볼륨까지 제거해 흔적을 남기지 않는다.
 */
export default function globalTeardown(): void {
  const compose = resolve(
    __dirname,
    "../../../ci/docker-composes/docker-compose.test.yaml",
  );
  execSync(`docker compose -f "${compose}" down -v`, { stdio: "inherit" });
}
