# 멀티테넌트(B2B SaaS) 전환 — 최종 실행 플랜

> 단일 테넌트 MVP 템플릿 → "Shared Database, Shared Schema" 멀티테넌트 아키텍처 전환
> 작성 기준: 실제 코드베이스 분석 반영 (2026-07-08)

---

## 0. 확정된 의사결정 (스코프)

| 항목 | 결정 |
|---|---|
| 격리 모델 | **Shared DB / Shared Schema** (row-level `tenantId`) + **Postgres RLS 안전망** |
| user ↔ tenant | **1:N** (유저는 하나의 테넌트에 소속, `User.tenantId`) |
| 테넌트 식별 | **서브도메인(Host)** + **`X-Tenant-Id` 헤더** 폴백 + **JWT 클레임** |
| 역할 | `USER` / `SUPER_ADMIN` / `TENANT_ADMIN` / `STAFF` (String const, **Prisma enum 아님**) |
| 결제 도메인 | **구독(티어)만.** `TenantSubscription` + `TenantBillingKey` + 전역 `SubscriptionPlan` |
| 크레딧 | **미구현.** 단, `Order`/`Payment` 단건결제 인프라는 tenant 스코프로 **보존**(추후 크레딧 재사용) |
| 고객→가맹점 결제 | 미구현. 확장 훅만 남김 |

### 첫 평가 대비 반영된 4대 보정
1. **RLS 병행** — Prisma Extension 단독은 중첩 관계/`$queryRaw` 우회 구멍 있음 → RLS로 최종 방어
2. **role은 `@pawlog/shared` const** — Prisma `enum Role` 아님. `packages/shared/src/roles.ts` 수정
3. **email 유니크 변경** — `@@unique([email])` → `@@unique([tenantId, email])`
4. **SUPER_ADMIN escape hatch** — 플랫폼 관리자는 테넌트 무소속, 자동 필터 우회 필요

---

## Phase 1 — Database 레이어 (`packages/database`)

### 1-1. 신규 `tenant.prisma`
```prisma
model Tenant {
  id        String   @id @default(uuid())
  name      String
  subdomain String   @unique          // 테넌트 식별자
  isActive  Boolean  @default(true)    // 구독 상태로 갱신, 미들웨어 게이트
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  users             User[]
  subscriptions     TenantSubscription[]
  billingKey        TenantBillingKey?
  orders            Order[]
  files             File[]
  // terms 는 전역 유지(테넌트 스코프 X) — 필요 시 후속
  @@map("tenants")
}
```

### 1-2. 기존 모델에 `tenantId` 부여 (격리 대상만)
- **부여**: `User`, `File`, `Order`, `Payment`, `PointTransaction`(정리 대상, 아래 참조)
- **전역 유지**: `SubscriptionPlan`(플랫폼 요금제), `Terms`(서비스 약관), `FileTemp`
- 각 모델: `tenantId String` + `tenant Tenant @relation(...)` + `@@index([tenantId])`
- **`User.tenantId`는 nullable** (SUPER_ADMIN = 플랫폼 무소속)
- **`User` 유니크 변경**: `@@unique([email])` → `@@unique([tenantId, email])`

### 1-3. 결제 도메인 재편 (구독 = 테넌트 주체)
- `UserSubscription` → **`TenantSubscription`** (주체 `userId` → `tenantId`)
- `BillingKey` → **`TenantBillingKey`** (`@@unique` per tenant)
- `SubscriptionPlan`: 전역 유지 + `tier`/`code` 필드 추가(티어 구분, row 기반)
- `Order`/`Payment`: `tenantId` 부여 후 **보존**(라우트는 SUPER_ADMIN 전용 또는 비활성). 추후 크레딧 단건결제 재사용
- `PointTransaction`(유저 포인트): **제거** — 크레딧(테넌트 원장)과 개념 다름. 템플릿 정갈성 우선

### 1-4. RLS 마이그레이션 (수동 SQL)
- 테넌트 스코프 테이블에 `ENABLE ROW LEVEL SECURITY`
- 정책: `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`
- 앱은 요청마다 `SET LOCAL app.tenant_id = '<tenantId>'` 실행 (Extension에서 주입)
- SUPER_ADMIN 경로용 `BYPASSRLS` 또는 정책 예외 계정/세션변수

### 1-5. `seed.ts`
- `default-tenant`(subdomain: `default`) **선행 생성**
- 기존 더미 유저/파일/구독을 default-tenant에 연결
- SUPER_ADMIN 유저 1명(tenantId=null) + TENANT_ADMIN 유저 1명(default-tenant) 생성

### 1-6. 마이그레이션 순서 (기존 데이터 안전)
`tenantId` nullable 추가 → default-tenant 백필 → non-null 전환(User 제외) → RLS 적용

---

## Phase 2 — 권한 체계 확장 (`packages/shared` + `apps/api`)

### 2-1. `packages/shared/src/roles.ts`
```ts
export const ROLES = {
  USER: "USER",
  SUPER_ADMIN: "SUPER_ADMIN",   // 기존 ADMIN 격상/대체
  TENANT_ADMIN: "TENANT_ADMIN", // 신규
  STAFF: "STAFF",               // 신규
} as const;
```

### 2-2. 기존 `ADMIN` 참조 일괄 교체 → `SUPER_ADMIN` (실제 3곳)
- `apps/api/src/admin/controllers/admin.controller.ts:26` `@Roles(ROLES.ADMIN)`
- `apps/api/src/admin/dtos/update-user-role.dto.ts` `@IsIn`, ApiProperty enum
- `packages/database/seed.ts` `role: "ADMIN"`

### 2-3. `RolesGuard` → 테넌트 인지 authorization
- role 검사 + **리소스 tenantId ↔ 유저 tenantId 일치** 검증 로직 추가
- `TENANT_ADMIN`은 자기 테넌트만, `STAFF`는 본인 소유(row-owner) 리소스만 — 후자는 별도 스코핑(테넌트 격리와 다른 레이어, 서비스단 처리)

---

## Phase 3 — Backend 테넌트 파이프라인 (`apps/api`)

### 3-1. AsyncLocalStorage 컨텍스트 (`shared/context/tenant-context.ts`)
- `AsyncLocalStorage<{ tenantId: string | null; bypass: boolean }>`
- `getTenantId()`, `runWithTenant()`, **`runWithoutTenant()`(escape hatch)** 제공

### 3-2. `TenantMiddleware` (`shared/middleware/tenant.middleware.ts`)
- Host 서브도메인 파싱 → 없으면 `X-Tenant-Id` 헤더 → 없으면 JWT 클레임
- `Tenant` 조회 → **`isActive === false` 시 즉시 `403 ForbiddenException`** (DB 자원 절약)
- **allowlist**(우회): `/health`, 인증 부트스트랩(`/v1/auth/*`), 테넌트 온보딩, SUPER_ADMIN 플랫폼 라우트
- `runWithTenant()` 안에서 `next()` 호출 (요청 생명주기 전체 컨텍스트 전파)
- 등록: `app.module.ts` `configure()` — LoggerMiddleware 다음, 라우트 지정

### 3-3. Prisma Client Extension 자동 필터 (`packages/database`)
- `index.ts`에 `$extends`로 확장된 클라이언트 구성 (싱글톤 위에)
- `query` 컴포넌트: `findMany/findFirst/findUnique/update/updateMany/delete/deleteMany/count/create` 등에서 ALS `tenantId`를 `where`/`data`에 자동 주입
- **`bypass` 플래그 시 주입 스킵** (SUPER_ADMIN)
- 트랜잭션 시작 시 `SET LOCAL app.tenant_id` 실행 → RLS 연동
- ⚠️ **한계 명시(주석+테스트)**: 중첩 include/`$queryRaw`는 Extension이 못 막음 → **RLS가 최종 방어선**

### 3-4. 인증/JWT 수정 (`auth`)
- `passport.config.ts` `JwtPayload`에 `tenantId` 추가, `validate()`가 `req.user`에 포함
- `auth.service.ts` payload: `{ userId, email, role, tenantId }`
- `login/signup/refresh`의 `findUnique({ where: { email } })` → **tenant 스코프 조회**로 변경 (email 유니크가 복합키가 됐으므로)
- 서브도메인으로 테넌트 확정 후 "해당 테넌트 소속 유저인지" 검증

### 3-5. 파일 스토리지 격리 (`shared/file/file.service.ts`)
- 저장 경로에 tenantId 삽입: `resources/uploads/[tenantId]/[domain]/[filename]`
- temp/upload/cloud(Azure Blob) 경로 모두 반영, ALS에서 tenantId 취득

---

## Phase 4 — Frontend (`apps/web`, `apps/admin`)

### 4-1. `apps/web/src/middleware.ts` (서브도메인 리라이트)
- `[subdomain].domain.com/path` → 내부 rewrite `/tenants/[subdomain]/path` (URL은 유지)
- 앱 라우트를 `app/tenants/[subdomain]/` route group으로 이동
- **로컬 개발**: `lvh.me`/`*.localhost`/hosts 세팅 안내 문서화 (DX 비용)

### 4-2. `apps/admin` 라우팅 가드
- **admin은 서브도메인 대신 단일 도메인 + role 라우팅** 권장(단순)
- `SUPER_ADMIN`(전체 관리) vs `TENANT_ADMIN`(자기 매장) 분기
- 기존 `(checkauth)` SSR 가드 확장 — role별 접근 페이지 제한

---

## Phase 5 — 검증

- **테넌트 격리 e2e 테스트(필수)**: 테넌트 A 토큰으로 B 데이터 조회/수정/삭제 차단 확인
- **중첩 관계 누출 테스트**: A 토큰으로 B 리소스 `include` 시 안 나오는지 (RLS 방어 증명)
- `RolesGuard` 4-role 유닛 테스트 갱신 (기존 `roles.guard.spec.ts`)
- 전체 `type-check` + `lint` 통과

---

## 리스크 & 주의

| 리스크 | 대응 |
|---|---|
| Prisma Extension 우회(중첩/raw) | **RLS 필수 병행** (Phase 1-4) |
| 닭-달걀(온보딩/로그인 시 테넌트 없음) | 미들웨어 **allowlist** |
| SUPER_ADMIN 기능 마비 | **escape hatch**(`runWithoutTenant` + bypass) |
| 기존 데이터 non-null 전환 실패 | nullable→백필→non-null 3단계 |
| 프론트 서브도메인 DX | 로컬 `lvh.me` 세팅 문서화 |

## 진행 순서 & 규모
**Phase 1 → 2 → 3 → 4 → 5** (DB부터 상향식). 현실적 규모 **약 1주+**.
크레딧은 추후 `CreditTransaction` 테이블 + 모듈 **추가만** 하면 됨 (순수 additive, 리팩토링 아님).
