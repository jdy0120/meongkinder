import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

let prismaInstance: PrismaClient | null = null;

const connect = async () => {
  if (prismaInstance) return prismaInstance; // 이미 연결되어 있으면 재사용

  const connectionString = process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  prismaInstance = new PrismaClient({ adapter });

  await prismaInstance.$connect();
  return prismaInstance;
};

const disconnect = async () => {
  if (!prismaInstance) return;
  await prismaInstance.$disconnect();
  prismaInstance = null;
};

export const prismaGetter = new Proxy({} as PrismaClient, {
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

export * from "./generated/prisma/client";
