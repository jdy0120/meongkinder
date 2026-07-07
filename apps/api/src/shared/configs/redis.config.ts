// Redis 연결 설정
// 도커에서는 compose 가 REDIS_HOST(=${PROJECT_NAME}-redis)를 주입합니다.
// 값은 env.ts 에서 검증된 뒤 주입됩니다.
import { env } from "./env";

export const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  // 비어있으면 비밀번호 없이 접속 (dev)
  password: env.REDIS_PASSWORD,
};
