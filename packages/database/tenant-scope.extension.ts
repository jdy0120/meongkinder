import { Prisma } from "./generated/prisma/client";
import { getTenantContext } from "./tenant-context";

/**
 * ALS tenantId 자동 주입 대상 모델 (schema 상 tenantId 컬럼을 가진 16개 모델).
 *
 * job-033 으로 아래 모델들이 대상에서 빠졌다:
 *   - User / UserInfo / UserTermsAgreement — 회원은 플랫폼 전역 정체성이 되었고 테넌트 소속은
 *     TenantMembership 이 표현한다. 더 이상 tenantId 컬럼 자체가 없다.
 *   - TenantMembership — "내가 속한 테넌트 목록"을 테넌트 컨텍스트 밖(교차 테넌트)에서 조회해야
 *     하므로 자동 주입하면 안 된다. 스코프는 서비스 레이어에서 userId/tenantId 로 명시한다.
 *
 * Pet / File / FileTemp 는 tenantId 가 nullable 이다(소속 없는 회원의 개인 데이터). 테넌트
 * 컨텍스트가 열려 있으면 그 테넌트로 스코프되고, bypass 면 주입하지 않는다 — "내 펫 전체"처럼
 * 테넌트를 가로지르는 조회는 호출부가 runWithoutTenant 로 감싸 명시적으로 표현한다.
 *
 * 전역 공용 모델(Terms, SubscriptionPlan, SocialAccount, Tenant)은 계속 제외.
 */
const TENANT_SCOPED_MODELS = new Set<string>([
  "Pet",
  "PetSchedule",
  "Attendance",
  "DailyReport",
  "ReportContent",
  "FeedPost",
  "FeedMedia",
  "FeedTag",
  "FeedTagCorrection",
  "NotificationLog",
  "File",
  "FileTemp",
  "Order",
  "Payment",
  "SubscriptionLedger",
  "TenantSubscription",
  "TenantBillingKey",
]);

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "aggregate",
  "count",
  "groupBy",
  "upsert",
]);

const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);

function injectWhere(where: unknown, tenantId: string): Record<string, unknown> {
  return { ...(where as Record<string, unknown> | undefined), tenantId };
}

function injectCreateData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...(row as Record<string, unknown>), tenantId }));
  }
  return { ...(data as Record<string, unknown> | undefined), tenantId };
}

/**
 * Prisma Client Extension — query 컴포넌트에서 ALS tenantId 를 16개 테넌트 스코프 모델의
 * where/data 에 자동 주입한다. bypass=true(SUPER_ADMIN, 전역 배치) 또는 tenantId 미해석 시 건너뛴다.
 *
 * 주의: 최상위 인자만 대상이다. nested write(예: pet.create({ data: { attendances: { create: {...} } } }))는
 * 자동 주입되지 않으므로 호출부에서 명시적으로 tenantId 를 채워야 한다 (docs/multi-tenant-migration-plan.md Phase 3-6 감사 대상).
 */
export const tenantScopeExtension = Prisma.defineExtension({
  name: "tenant-scope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const { tenantId, bypass } = getTenantContext();
        if (bypass || !tenantId || !model || !TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const scopedArgs = args as Record<string, unknown>;

        if (WHERE_OPERATIONS.has(operation)) {
          scopedArgs.where = injectWhere(scopedArgs.where, tenantId);
        }
        if (CREATE_OPERATIONS.has(operation)) {
          scopedArgs.data = injectCreateData(scopedArgs.data, tenantId);
        }
        if (operation === "upsert") {
          scopedArgs.create = injectCreateData(scopedArgs.create, tenantId);
        }

        return query(scopedArgs);
      },
    },
  },
});
