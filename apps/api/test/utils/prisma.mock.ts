/**
 * Prisma 목 유틸.
 *
 * 서비스들은 `@pawlog/database` 의 전역 싱글턴 `prisma` 를 직접 import 해서 씁니다
 * (DI 주입 아님). 따라서 순수 유닛 테스트에서는 이 모듈 전체를 목킹해야 합니다.
 *
 * 사용법 (spec 파일 최상단):
 *
 *   import { prismaMock } from "../../../test/utils/prisma.mock";
 *
 *   jest.mock("@pawlog/database", () => {
 *     const { createDatabaseMock } = require("../../../test/utils/prisma.mock");
 *     return createDatabaseMock();
 *   });
 *
 *   // 이후 테스트에서:
 *   prismaMock.user.findUnique.mockResolvedValue(null);
 *
 * 각 테스트 사이 상태 초기화는 spec 의 beforeEach 에서 resetPrismaMock() 호출.
 */
import { mockDeep, mockReset, type DeepMockProxy } from "jest-mock-extended";
import type { PrismaClient } from "@pawlog/database";

export type PrismaMock = DeepMockProxy<PrismaClient>;

/** 모든 모델/메서드가 jest.fn 으로 채워진 deep 목 인스턴스 */
export const prismaMock: PrismaMock = mockDeep<PrismaClient>();

/** 각 테스트 사이 목 호출 기록/구현을 초기화 */
export const resetPrismaMock = (): void => {
  mockReset(prismaMock);
};

/**
 * `jest.mock("@pawlog/database", ...)` 팩토리에서 반환할 객체.
 * 서비스가 import 하는 named export 를 모두 목으로 대체한다.
 */
export const createDatabaseMock = () => ({
  __esModule: true,
  prisma: prismaMock,
  prismaConnect: jest.fn(),
  prismaDisconnect: jest.fn(),
});
