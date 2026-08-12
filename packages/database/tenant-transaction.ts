import type { ExtendedPrismaClient, ExtendedTransactionClient } from "./client";
import { getTenantId } from "./tenant-context";

/**
 * RLS 와 연동되는 인터랙티브 트랜잭션.
 * ALS 에 tenantId 가 있으면 트랜잭션 진입 직후 `SET LOCAL app.tenant_id` 를 실행해
 * Postgres RLS 정책(`USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`)이 적용되도록 한다.
 * bypass(SUPER_ADMIN, 전역 배치) 이거나 tenantId 미해석 시에는 SET LOCAL 을 생략한다
 * (dev DB 는 RLS 를 우회하는 superuser 로 접속하므로 지금 당장은 영향 없음).
 *
 * 배열형 `$transaction([...])` 는 SQL 을 끼워넣을 수 없어 RLS 와 연동될 수 없으므로,
 * tenantId 가 얽힌 트랜잭션은 반드시 이 헬퍼(또는 동일 패턴의 `prisma.$transaction(async (tx) => ...)`)를 사용해야 한다.
 */
export function tenantTransaction<T>(
  client: ExtendedPrismaClient,
  fn: (tx: ExtendedTransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    const tenantId = getTenantId();
    if (tenantId) {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    }
    return fn(tx);
  });
}
