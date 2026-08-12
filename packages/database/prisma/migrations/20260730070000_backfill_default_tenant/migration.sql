-- job-020 Stage 2/3: default-tenant 시드 생성 + 기존 로우 백필.
-- 고정 UUID를 사용해 seed.ts(subdomain="default" upsert)와 동일한 테넌트로 수렴시킵니다.

INSERT INTO "tenants" ("id", "name", "subdomain", "is_active", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("subdomain") DO NOTHING;

UPDATE "users" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "user_infos" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "pets" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "attendances" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "daily_reports" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "report_contents" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "notification_logs" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "files" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "file_temps" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "orders" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "payments" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "subscription_ledgers" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "user_terms_agreements" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

-- 결제 도메인 재편 대상: 기존 userId 기준 로우를 모두 default-tenant 소유로 백필
-- (userId 별로 여러 건이 있었다면 다음 마이그레이션의 tenant_id UNIQUE 전환 전에 직접 정리가 필요하나,
--  현재까지 결제 연동 미완료(TOSS_SECRET_KEY 미설정) 상태라 운영 데이터가 없어 안전합니다.)
UPDATE "billing_keys" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
UPDATE "user_subscriptions" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;
