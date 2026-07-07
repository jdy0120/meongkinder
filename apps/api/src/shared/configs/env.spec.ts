import { env } from "./env";
import { createDatabaseMock } from "../../../test/utils/prisma.mock";

/**
 * Tier 0 하네스 검증.
 * 이 테스트가 통과하면 다음이 모두 증명된다:
 *  - jest setupFiles 가 .env.test 를 로드했다
 *  - env.ts 가 그 값을 검증/파싱해 export 했다 (실패 시 process.exit 로 워커가 죽음)
 *  - prisma 목 유틸이 정상 구성된다
 */
describe("test harness (Tier 0)", () => {
  it("loads .env.test and validates env", () => {
    expect(env.ACCESS_JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.REFRESH_JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.SIGN_UP_JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.DATABASE_URL).toMatch(/^postgres(ql)?:\/\//);
    expect(env.REDIS_PORT).toBe(6379);
  });

  it("parses the '30*60' duration convention into seconds", () => {
    expect(env.ACCESS_JWT_EXPIRED_SEC).toBe(30 * 60);
  });

  it("provides a deep-mocked prisma via the database mock factory", () => {
    const dbMock = createDatabaseMock();
    // deep 목의 중첩 메서드 참조는 unbound-method 규칙의 false positive.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(jest.isMockFunction(dbMock.prisma.user.findUnique)).toBe(true);
    expect(jest.isMockFunction(dbMock.prismaConnect)).toBe(true);
  });
});
