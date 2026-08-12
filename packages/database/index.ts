import "dotenv/config";
import {
  createExtendedClient,
  type ExtendedPrismaClient,
  type ExtendedTransactionClient,
} from "./client";

let prismaInstance: ExtendedPrismaClient | null = null;

const connect = async () => {
  if (prismaInstance) return prismaInstance; // 이미 연결되어 있으면 재사용

  prismaInstance = createExtendedClient(process.env.DATABASE_URL);

  await prismaInstance.$connect();
  return prismaInstance;
};

const disconnect = async () => {
  if (!prismaInstance) return;
  await prismaInstance.$disconnect();
  prismaInstance = null;
};

export const prismaGetter = new Proxy({} as ExtendedPrismaClient, {
  get(target, prop, receiver) {
    if (!prismaInstance) {
      throw new Error(
        "DB 연결이 안 되었습니다! prismaConnect()를 먼저 호출하세요.",
      );
    }
    return Reflect.get(prismaInstance, prop, receiver);
  },
});

export {
  connect as prismaConnect,
  disconnect as prismaDisconnect,
  prismaGetter as prisma,
};

export type { ExtendedPrismaClient, ExtendedTransactionClient };
export { tenantTransaction } from "./tenant-transaction";
export {
  runWithTenant,
  runWithoutTenant,
  getTenantContext,
  getTenantId,
  requireTenantId,
  isBypass,
  type TenantContext,
} from "./tenant-context";

export * from "./generated/prisma/client";
