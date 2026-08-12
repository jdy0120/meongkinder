-- job-020 Stage 1/3: Tenant 모델 신설 + 기존 13개 모델(및 결제 도메인 재편 대상 2개)에
-- tenantId 컬럼을 nullable 로 우선 추가합니다. (CLAUDE.md §10: nullable 추가 -> 백필 -> non-null 전환)
-- 다음 마이그레이션에서 default-tenant 로 백필한 뒤, 그 다음 마이그레이션에서 non-null 로 전환합니다.

-- CreateTable: Tenant
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- 사용하지 않는 PointTransaction 모델 제거 (템플릿 정갈성, 크레딧 개념과 상이 — docs/multi-tenant-migration-plan.md 1-2)
ALTER TABLE "point_transactions" DROP CONSTRAINT "point_transactions_userId_fkey";
DROP TABLE "point_transactions";

-- AlterTable: tenant_id nullable 추가 (13개 스코프 모델)
ALTER TABLE "users" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "user_infos" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "pets" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "attendances" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "daily_reports" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "report_contents" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "notification_logs" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "files" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "file_temps" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "orders" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "payments" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "subscription_ledgers" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "user_terms_agreements" ADD COLUMN "tenant_id" UUID;

-- AlterTable: 결제 도메인 재편 대상(BillingKey/UserSubscription) 도 동일하게 nullable tenant_id 우선 추가
-- (다음 마이그레이션에서 userId -> tenantId 주체 전환 + 테이블명 변경까지 수행)
ALTER TABLE "billing_keys" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "user_subscriptions" ADD COLUMN "tenant_id" UUID;

-- AddForeignKey (nullable 이므로 값이 채워지기 전에도 제약 추가 가능)
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_infos" ADD CONSTRAINT "user_infos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pets" ADD CONSTRAINT "pets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_contents" ADD CONSTRAINT "report_contents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_temps" ADD CONSTRAINT "file_temps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_ledgers" ADD CONSTRAINT "subscription_ledgers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_terms_agreements" ADD CONSTRAINT "user_terms_agreements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_keys" ADD CONSTRAINT "billing_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
