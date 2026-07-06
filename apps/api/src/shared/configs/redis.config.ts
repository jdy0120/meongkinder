// Redis 연결 설정
// 도커에서는 compose 가 REDIS_HOST(=${PROJECT_NAME}-redis)를 주입합니다.

export const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  // 비어있으면 비밀번호 없이 접속 (dev)
  password: process.env.REDIS_PASSWORD || undefined,
};
