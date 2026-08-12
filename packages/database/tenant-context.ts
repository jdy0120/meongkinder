import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  // 요청을 처리 중인 테넌트 id. bypass=true 이거나 아직 테넌트가 식별되지 않았으면 null.
  tenantId: string | null;
  // true 면 Prisma Extension 이 tenantId 자동 주입을 건너뛴다 (SUPER_ADMIN / 배치 전역 작업 escape hatch).
  bypass: boolean;
}

const DEFAULT_CONTEXT: TenantContext = { tenantId: null, bypass: true };

const als = new AsyncLocalStorage<TenantContext>();

/**
 * ⚠️ Prisma 의 지연 실행(lazy PrismaPromise)과 ALS 의 상호작용 주의 (job-035).
 *
 * `prisma.x.findMany()` 는 호출 즉시 쿼리를 보내지 않고 **PrismaPromise 를 반환만** 한다.
 * 실제 실행은 `.then()`(=await) 시점이다. 따라서 아래처럼 쓰면 콜백은 ALS 안에서 실행되지만
 * 정작 쿼리는 컨텍스트를 벗어난 뒤 실행되어, Extension 이 **바깥 컨텍스트**를 읽는다:
 *
 *   ❌ runWithoutTenant(() => prisma.pet.create(...))   // 바깥 tenantId 가 주입됨
 *
 * 이 함정을 호출부마다 기억하게 두는 대신, 여기서 콜백을 `await` 해 컨텍스트 안에서 쿼리가
 * 완료되도록 보장한다. 그래서 두 헬퍼 모두 항상 Promise 를 반환한다.
 */
async function runIn<T>(
  context: TenantContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  return als.run(context, async () => await fn());
}

/** 특정 테넌트로 스코프된 컨텍스트 안에서 fn 을 실행한다 (TenantMiddleware, 배치의 테넌트 루프에서 사용). */
export function runWithTenant<T>(
  tenantId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  return runIn({ tenantId, bypass: false }, fn);
}

/** 테넌트 스코프를 우회하는 컨텍스트 안에서 fn 을 실행한다 (SUPER_ADMIN 플랫폼 라우트, 전역 배치). */
export function runWithoutTenant<T>(fn: () => T | Promise<T>): Promise<T> {
  return runIn({ tenantId: null, bypass: true }, fn);
}

/**
 * 현재 컨텍스트를 반환한다. ALS 스토어가 없는 경우(TenantMiddleware 밖 — 유닛테스트, 스크립트 등)에는
 * DEFAULT_CONTEXT(bypass=true)로 안전하게 폴백해 자동 주입이 조용히 오작동하지 않도록 한다.
 */
export function getTenantContext(): TenantContext {
  return als.getStore() ?? DEFAULT_CONTEXT;
}

export function getTenantId(): string | null {
  return getTenantContext().tenantId;
}

/**
 * 현재 컨텍스트의 tenantId 를 반환하되, 없으면 즉시 에러를 던진다.
 * "테넌트당 1개"류 유니크 키(TenantBillingKey.tenantId 등)를 명시적으로 조회해야 하는
 * 호출부에서 사용한다 — 자동 주입(Prisma Extension)에 기대지 않고 실패를 드러낸다.
 */
export function requireTenantId(): string {
  const { tenantId, bypass } = getTenantContext();
  if (bypass || !tenantId) {
    throw new Error(
      "현재 요청 컨텍스트에서 tenantId 를 확인할 수 없습니다 (TenantMiddleware 미적용 또는 SUPER_ADMIN bypass).",
    );
  }
  return tenantId;
}

export function isBypass(): boolean {
  return getTenantContext().bypass;
}
