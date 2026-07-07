/**
 * 테스트 환경변수 로더 — jest `setupFiles` 로 등록되어, 각 테스트 파일의 모듈
 * import 보다 먼저 실행됩니다.
 *
 * 왜 필요한가:
 *   env.ts 는 import 시점에 process.env 를 검증하고 실패 시 process.exit(1) 합니다.
 *   테스트에서 AppModule/token.ts 를 import 하면 env.ts 가 평가되므로, 그 전에
 *   반드시 유효한 env 가 process.env 에 있어야 워커가 죽지 않습니다.
 *
 * 우선순위:
 *   dotenv 는 기본적으로 "이미 존재하는" process.env 를 덮어쓰지 않습니다(override 미지정).
 *   → CI(예: GitHub Actions env, Vault export)가 주입한 값이 이기고, .env.test 는
 *     비어 있는 값만 채웁니다. 로컬에서는 .env.test 더미가 그대로 사용됩니다.
 */
import { config } from "dotenv";
import { resolve } from "path";

// apps/api/test → 레포 루트의 envs/.env.test
// quiet: dotenv v17 의 로드 로그를 억제해 테스트 출력을 깔끔하게 유지.
config({ path: resolve(__dirname, "../../../envs/.env.test"), quiet: true });

// 안전장치: 테스트 컨텍스트임을 명시. (운영 DB 오조준 방지 가드는 e2e 단계에서 강화)
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
