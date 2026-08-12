-- job-020: 테넌트 스코프 테이블에 Postgres RLS 활성화.
-- 애플리케이션은 요청마다 `SET LOCAL app.tenant_id = '<tenantId>'` 를 실행해야 합니다(Phase 3-3 연동 예정).
-- FORCE ROW LEVEL SECURITY 를 함께 지정해 테이블 소유자(마이그레이션/앱이 같은 DB 유저를 쓰는 현재 구성)도
-- 정책을 우회하지 못하도록 합니다. SUPER_ADMIN 등 플랫폼 전역 접근은 별도 BYPASSRLS 역할/컨텍스트로 처리합니다
-- (docs/multi-tenant-migration-plan.md Phase 3 SUPER_ADMIN escape hatch).
--
-- users.tenant_id 는 nullable(SUPER_ADMIN)이라 NULL 인 로우는 어떤 테넌트 컨텍스트에서도 매칭되지 않습니다
-- (fail-closed). 그 로우들은 위 escape hatch 경로로만 조회되어야 합니다.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "users"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "user_infos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_infos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "user_infos"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "pets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "pets"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "attendances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendances" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "attendances"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "daily_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "daily_reports"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "report_contents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_contents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "report_contents"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "notification_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "notification_logs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "files"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "file_temps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_temps" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "file_temps"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "orders"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "payments"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "subscription_ledgers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_ledgers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "subscription_ledgers"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "user_terms_agreements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_terms_agreements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "user_terms_agreements"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_billing_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_billing_keys" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "tenant_billing_keys"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "tenant_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "tenant_subscriptions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
