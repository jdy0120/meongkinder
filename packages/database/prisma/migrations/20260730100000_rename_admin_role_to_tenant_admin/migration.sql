-- job-021: 4-역할 RBAC(USER/STAFF/TENANT_ADMIN/SUPER_ADMIN) 도입.
-- role 컬럼은 여전히 plain String 이므로 컬럼 정의 변경은 없고, 기존 "ADMIN" 값만 "TENANT_ADMIN" 으로 백필한다.

UPDATE "users" SET "role" = 'TENANT_ADMIN' WHERE "role" = 'ADMIN';
