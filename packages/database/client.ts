import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { tenantScopeExtension } from "./tenant-scope.extension";

export function createExtendedClient(connectionString: string | undefined) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter }).$extends(tenantScopeExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

type TransactionCallback = Parameters<ExtendedPrismaClient["$transaction"]>[0];
export type ExtendedTransactionClient =
  TransactionCallback extends (tx: infer TX) => unknown ? TX : never;
