-- job-020 Stage 3/3: tenant_id 를 NOT NULL 로 전환(User 는 SUPER_ADMIN escape hatch 로 nullable 유지)
-- + User 유니크 키를 [tenantId, email] 복합으로 전환 + 결제 도메인 주체를 User -> Tenant 로 재편.

-- AlterTable: non-null 전환 (User 제외) + 인덱스 추가
ALTER TABLE "user_infos" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "pets" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "attendances" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "daily_reports" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "report_contents" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "notification_logs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "files" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "file_temps" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "subscription_ledgers" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "user_terms_agreements" ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "user_infos_tenant_id_idx" ON "user_infos"("tenant_id");
CREATE INDEX "pets_tenant_id_idx" ON "pets"("tenant_id");
CREATE INDEX "attendances_tenant_id_idx" ON "attendances"("tenant_id");
CREATE INDEX "daily_reports_tenant_id_idx" ON "daily_reports"("tenant_id");
CREATE INDEX "report_contents_tenant_id_idx" ON "report_contents"("tenant_id");
CREATE INDEX "notification_logs_tenant_id_idx" ON "notification_logs"("tenant_id");
CREATE INDEX "files_tenant_id_idx" ON "files"("tenant_id");
CREATE INDEX "file_temps_tenant_id_idx" ON "file_temps"("tenant_id");
CREATE INDEX "orders_tenant_id_idx" ON "orders"("tenant_id");
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");
CREATE INDEX "subscription_ledgers_tenant_id_idx" ON "subscription_ledgers"("tenant_id");
CREATE INDEX "user_terms_agreements_tenant_id_idx" ON "user_terms_agreements"("tenant_id");

-- AlterTable: User 유니크 키 [email] -> [tenantId, email] (tenantId 는 nullable 유지)
-- (기존 "users_email_key" 는 ADD CONSTRAINT 가 아닌 순수 UNIQUE INDEX 로 생성되어 있어 DROP INDEX 사용)
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- ============================================================
-- 결제 도메인 재편: BillingKey -> TenantBillingKey (주체 User -> Tenant)
-- ============================================================
ALTER TABLE "billing_keys" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "billing_keys" DROP CONSTRAINT "billing_keys_userId_fkey";
DROP INDEX "billing_keys_userId_key";
ALTER TABLE "billing_keys" DROP COLUMN "userId";

ALTER TABLE "billing_keys" RENAME TO "tenant_billing_keys";
ALTER TABLE "tenant_billing_keys" RENAME CONSTRAINT "billing_keys_pkey" TO "tenant_billing_keys_pkey";
-- customerKey 유니크도 순수 인덱스라 ALTER INDEX 로 개명 (RENAME CONSTRAINT 대상 아님)
ALTER INDEX "billing_keys_customerKey_key" RENAME TO "tenant_billing_keys_customerKey_key";
ALTER TABLE "tenant_billing_keys" RENAME CONSTRAINT "billing_keys_tenant_id_fkey" TO "tenant_billing_keys_tenant_id_fkey";
CREATE UNIQUE INDEX "tenant_billing_keys_tenant_id_key" ON "tenant_billing_keys"("tenant_id");

-- ============================================================
-- 결제 도메인 재편: UserSubscription -> TenantSubscription (주체 User -> Tenant)
-- ============================================================
ALTER TABLE "user_subscriptions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "user_subscriptions" DROP CONSTRAINT "user_subscriptions_userId_fkey";
DROP INDEX "user_subscriptions_userId_idx";
ALTER TABLE "user_subscriptions" DROP COLUMN "userId";

ALTER TABLE "user_subscriptions" RENAME TO "tenant_subscriptions";
ALTER TABLE "tenant_subscriptions" RENAME CONSTRAINT "user_subscriptions_pkey" TO "tenant_subscriptions_pkey";
ALTER TABLE "tenant_subscriptions" RENAME CONSTRAINT "user_subscriptions_billingKeyId_fkey" TO "tenant_subscriptions_billingKeyId_fkey";
ALTER TABLE "tenant_subscriptions" RENAME CONSTRAINT "user_subscriptions_planId_fkey" TO "tenant_subscriptions_planId_fkey";
ALTER TABLE "tenant_subscriptions" RENAME CONSTRAINT "user_subscriptions_tenant_id_fkey" TO "tenant_subscriptions_tenant_id_fkey";
CREATE INDEX "tenant_subscriptions_tenant_id_idx" ON "tenant_subscriptions"("tenant_id");
