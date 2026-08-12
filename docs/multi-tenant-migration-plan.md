# 멀티테넌트(B2B SaaS) 전환 — 실행 플랜 v2

> 단일 테넌트 MVP → "Shared Database, Shared Schema" 멀티테넌트 아키텍처 전환
>
> **v2 개정 (2026-07-30)**: v1(2026-07-08)은 설계 스케치 기준으로 "약 1주+"를 제시했으나,
> 코드베이스를 실측한 결과 파일 스토리지·트랜잭션·정적 서빙 세 영역에서 v1이 누락한 비용이 확인되어 전면 재산정했습니다.
> **실작업 30.5d (Phase 0 포함 32.5d), 버퍼 포함 1인 기준 약 7~8주.**

---

## 0. 아키텍처 결정 (v1 유지)

| 항목 | 결정 |
|---|---|
| 격리 모델 | **Shared DB / Shared Schema** (row-level `tenantId`) + **Postgres RLS 안전망** |
| user ↔ tenant | **1:N** (유저는 하나의 테넌트에 소속, `User.tenantId`) |
| 테넌트 식별 | **서브도메인(Host)** + **`X-Tenant-Id` 헤더** 폴백 + **JWT 클레임** |
| 역할 | `USER` / `SUPER_ADMIN` / `TENANT_ADMIN` / `STAFF` (String const, **Prisma enum 아님**) |
| 결제 도메인 | **구독(티어)만.** `TenantSubscription` + `TenantBillingKey` + 전역 `SubscriptionPlan` |
| 크레딧 | **미구현.** 단 `Order`/`Payment` 단건결제 인프라는 tenant 스코프로 **보존** |
| 고객→가맹점 결제 | 미구현. 확장 훅만 남김 |
| 파일 접근 | **정적 마운트 제거 → 인증된 스트리밍 엔드포인트** (v2 신규 결정, Phase 4) |

### v1의 4대 보정 (유지)

1. **RLS 병행** — Prisma Extension 단독은 중첩 관계/raw 우회 구멍 있음 → RLS로 최종 방어
2. **role은 `@pawlog/shared` const** — Prisma `enum` 아님. `packages/shared/src/roles.ts` 수정
3. **email 유니크 변경** — `@@unique([email])` → `@@unique([tenantId, email])`
4. **SUPER_ADMIN escape hatch** — 플랫폼 관리자는 테넌트 무소속, 자동 필터 우회 필요

---

## 1. 계측된 영향 범위 (2026-07-30 기준)

공수 산정의 근거 수치입니다. 재산정 시 이 표를 먼저 갱신하세요.

| 항목 | 수치 | 비고 |
|---|---:|---|
| Prisma 모델 | 19 | 테넌트 스코프 대상 ~13 |
| Prisma 호출 사이트 | **144** | 15개 서비스 파일 |
| `$transaction` | **28** | 배열형 21 / 인터랙티브 6 |
| API 엔드포인트 | 81 | 14개 컨트롤러 |
| `@Cron` 배치 | 4 | 요청 컨텍스트 밖 |
| `where: { email }` | 5 | 복합 유니크 전환 영향 |
| 파일 경로 조립 지점 | 4 | 중복 구현 |
| 기존 테스트 | **4** | `.spec.ts` — 회귀 안전망 사실상 없음 |
| 코드량 | api 8.7k / admin 6.0k / web 3.0k 줄 | |
| 프론트 | web 9페이지·16훅 / admin 11페이지·28훅 | |

### 호출 사이트 분포 (상위)

```
38  subscription/services/subscription.service.ts     ← 최대 난관 (+ tx 5)
15  care/services/attendance.service.ts
15  admin/services/admin.service.ts
14  payment/services/payment.service.ts
12  subscription/services/subscription-ledger.service.ts
 9  care/services/daily-report.service.ts
 7  care/services/report-content.service.ts
 7  auth/services/auth.service.ts
 6  terms/services/terms.service.ts
 6  pet/services/pet.service.ts
```

### v1 대비 변경점

| # | v1 | v2 | 사유 |
|---|---|---|---|
| 1 | 파일 격리 = 경로에 tenantId 삽입 (소규모) | **독립 Phase, 6.0d** | 정적 마운트가 가드를 우회 — 경로 분리만으로 격리 불가 |
| 2 | 트랜잭션 언급 없음 | **배열형 21곳 인터랙티브 전환** | RLS `SET LOCAL`이 `$transaction([...])` 안에 들어갈 수 없음 |
| 3 | 테스트 = Phase 5 검증만 | **Phase 0 특성화 테스트 선행** | spec 4개로 144곳 리팩터는 회귀 감지 불가 |
| 4 | 프론트 = 라우팅 위주 | **쿼리키 테넌트 반영 추가** | 44개 훅 캐시가 테넌트 간 오염됨 |
| 5 | 총 "약 1주+" | **30.5d** | 위 누락분 반영 |

---

## Phase 0 — 안전망 구축 (선행 권장)

> 생략 가능하나, 생략 시 Phase 3의 144개 호출 사이트 수정에서 회귀를 잡을 방법이 없습니다.

- 핵심 플로우 특성화(characterization) 테스트: 로그인/회원가입, 펫 CRUD, 출석 등·하원, 일일리포트 생성+사진, 구독 조회
- 목적은 "현재 동작을 고정"하는 것 — 커버리지 목표 아님
- `pnpm --filter api test` 그린 상태 확보

**2.0d**

---

## Phase 1 — DB 스키마 & RLS (`packages/database`)

### 1-1. `tenant.prisma` 신설

```prisma
model Tenant {
  id        String   @id @default(uuid())
  name      String
  subdomain String   @unique          // 테넌트 식별자
  isActive  Boolean  @default(true)   // 구독 상태로 갱신, 미들웨어 게이트

  users         User[]
  subscriptions TenantSubscription[]
  billingKey    TenantBillingKey?
  // ... 스코프 대상 모델 역참조

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")
  @@map("tenants")
}
```

### 1-2. 기존 모델에 `tenantId` 부여

- 대상(~13): `User` `Pet` `Attendance` `DailyReport` `ReportContent` `NotificationLog`
  `File` `FileTemp` `Order` `Payment` `SubscriptionLedger` `UserTermsAgreement` `UserInfo`
- 전역 유지(스코프 X): `Terms` `SubscriptionPlan` (플랫폼 공통), `SocialAccount` (User 종속)
- 각 모델: `tenantId String` + `tenant Tenant @relation(...)` + `@@index([tenantId])`
- **`User.tenantId`는 nullable** (SUPER_ADMIN = 플랫폼 무소속)
- **`User` 유니크 변경**: `@@unique([email])` → `@@unique([tenantId, email])`
  - 영향: `auth.service.ts:46,98,139,170` + `social-auth.service.ts:275` (Phase 3-4에서 처리)
- `PointTransaction` **제거** (크레딧과 개념 상이, 템플릿 정갈성 우선)

### 1-3. 결제 도메인 재편 — 주체 유저 → 테넌트

- `UserSubscription` → **`TenantSubscription`** (`userId` → `tenantId`)
- `BillingKey` → **`TenantBillingKey`** (`@@unique` per tenant)
- `Order`/`Payment`: `tenantId` 부여 후 **보존**. 라우트는 SUPER_ADMIN 전용 또는 비활성. 추후 크레딧 재사용
- ⚠️ `subscription.service.ts`(호출 38 + tx 5)가 이 변경의 직격탄. 자동 주입으로 안 끝나고 로직 재작성 필요

### 1-4. Postgres RLS

- 스코프 테이블에 `ENABLE ROW LEVEL SECURITY`
- 정책: `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`
- 앱은 요청마다 `SET LOCAL app.tenant_id = '<tenantId>'` (Phase 3-3에서 연동)

### 1-5. 마이그레이션 & 시드

- **CLAUDE.md §10 준수** — `db push` 금지, 반드시 마이그레이션 파일 커밋 (기존 마이그레이션 7개 뒤에 이어붙임)
- 3단계: `tenantId` nullable 추가 → `default-tenant` 백필 → non-null 전환(`User` 제외) → RLS 적용
- `default-tenant`(subdomain: `default`) 선행 생성, 기존 더미 데이터 연결
- SUPER_ADMIN 1명(`tenantId=null`) + TENANT_ADMIN 1명(default-tenant) 시드

| 세부 | 공수 |
|---|---:|
| `tenant.prisma` + 13모델 `tenantId`/인덱스 | 0.5d |
| `User` 복합 유니크 전환 | 0.5d |
| 결제 도메인 재편 | 1.5d |
| RLS 정책 | 1.0d |
| 3단계 마이그레이션 + 시드 | 1.0d |
| | **4.5d** |

> 작업 후 `pnpm --filter @pawlog/database build` 필수 (dist 자동 리빌드 안 됨)

---

## Phase 2 — RBAC 4-role

### 2-1. `packages/shared/src/roles.ts`

```ts
export const ROLES = {
  USER: "USER",
  STAFF: "STAFF",                 // 신규 — 현장 스태프
  TENANT_ADMIN: "TENANT_ADMIN",   // 신규 — 매장 관리자
  SUPER_ADMIN: "SUPER_ADMIN",     // 신규 — 플랫폼 관리자
} as const;
```

- 기존 `ADMIN` → `TENANT_ADMIN` 매핑 (마이그레이션에 `UPDATE users SET role=...` 포함)
- 작업 후 `pnpm --filter @pawlog/shared build`

### 2-2. `RolesGuard` 테넌트 인지 확장

- role 검사 + **리소스 `tenantId` ↔ 유저 `tenantId` 일치** 검증
- `SUPER_ADMIN` 전역 통과(escape hatch), `TENANT_ADMIN`은 자기 테넌트, `STAFF`는 본인 소유 리소스만
- `roles.guard.spec.ts` 4-role 케이스로 갱신
- 81개 엔드포인트 `@Roles` 재지정 전수 검토 — 특히 `admin.service.ts:186`처럼 현재 무스코프 조회하는 지점

**1.5d**

---

## Phase 3 — 백엔드 테넌트 파이프라인 (`apps/api`)

### 3-1. ALS 컨텍스트 (`shared/context/tenant-context.ts`)

- `AsyncLocalStorage<{ tenantId: string | null; bypass: boolean }>`
- `getTenantId()` / `runWithTenant()` / **`runWithoutTenant()`** (SUPER_ADMIN·배치용 escape hatch)

### 3-2. `TenantMiddleware` (`shared/middleware/tenant.middleware.ts`)

- Host 서브도메인 → `X-Tenant-Id` 헤더 → JWT 클레임 순 폴백
- `Tenant` 조회 → `isActive === false` 시 즉시 **403** (DB 자원 절약)
- **allowlist**: `/health`, `/v1/auth/*`(부트스트랩), 테넌트 온보딩, SUPER_ADMIN 플랫폼 라우트
- `runWithTenant()` 안에서 `next()`
- ⚠️ 기존 `LoggerMiddleware`가 `forRoutes("*path")`로 등록됨. 등록 순서 및 **multer보다 먼저 실행되는지** 검증 필요 (Phase 4-3 의존)

### 3-3. Prisma Client Extension + 트랜잭션 연동

- `query` 컴포넌트에서 ALS `tenantId`를 `where`/`data`에 자동 주입 (19모델 매핑, nested write 포함)
- `bypass=true`면 주입 생략
- **배열형 `$transaction([...])` 21곳 → 인터랙티브 `$transaction(async (tx) => {...})` 전환**
  - 사유: RLS는 같은 트랜잭션 안에서 `SET LOCAL app.tenant_id`가 선행돼야 하는데 배열형은 SQL을 끼워넣을 수 없음
  - CLAUDE.md §3의 `resolvePagination` + `buildPaginatedData` 페이지네이션 패턴이 대부분 배열형이라 함께 조정
- 트랜잭션 진입 시 `SET LOCAL` 실행 → RLS 연동

### 3-4. 인증 흐름

- `passport.config.ts` `JwtPayload`에 `tenantId` 추가, `validate()`가 `req.user`에 포함
- `auth.service.ts` payload: `{ userId, email, role, tenantId }`
- `where: { email }` 5곳 → 테넌트 스코프 복합 조회로 변경
- 서브도메인으로 테넌트 확정 후 "해당 테넌트 소속 유저인지" 검증

### 3-5. 배치 4종 처리

`@Cron`은 요청 밖이라 ALS 컨텍스트가 없습니다. 각각 **테넌트 루프** 또는 **bypass** 결정:

| 배치 | 위치 | 처리 |
|---|---|---|
| 구독 갱신 (02시) | `subscription-scheduler.service.ts:12` | 테넌트 루프 |
| 구독 만료 (03시) | `subscription-scheduler.service.ts:20` | 테넌트 루프 |
| 예약 리마인드 (20시) | `notification-reminder-scheduler.service.ts:24` | 테넌트 루프 |
| temp 정리 (04시) | `file-scheduler.service.ts:12` | bypass (전역) |

### 3-6. 144개 호출 사이트 전수 감사

Extension 자동 주입으로 대부분 무변경이지만, 누락 시 조용히 유출되므로 전수 확인 필요.

| 세부 | 공수 |
|---|---:|
| ALS 컨텍스트 + `TenantMiddleware` | 1.5d |
| Prisma Extension 자동 주입 | 2.0d |
| 트랜잭션 28곳 RLS 연동 (배열형 21 전환) | 1.5d |
| 인증 흐름 | 1.0d |
| 배치 4종 | 0.5d |
| 호출 사이트 144곳 감사 | 1.0d |
| | **7.5d** |

---

## Phase 4 — 파일 스토리지 격리 (v2 신규 독립 Phase)

### 4-1. 현재 구조의 문제

| # | 문제 | 위치 |
|---|---|---|
| 🔴 1 | **`/resources/` 정적 마운트에 인증 없음.** `useStaticAssets`는 express 미들웨어라 `JwtAccessGuard`보다 먼저 실행 → 경로만 알면 토큰 없이 다운로드. 경로에 `tenantId`를 넣으면 오히려 유추 가능해져 **크로스 테넌트 유출 경로**가 됨 | `shared/configs/app.setup.ts:59` |
| 🔴 2 | **`getFileUrl()` 소유권 검사 없음.** `findUnique({where:{id}})` 후 즉시 URL(Azure SAS 포함) 발급 | `shared/file/services/file.service.ts:60` |
| 🟡 3 | **경로 조립 4곳 중복.** 디스크 경로와 DB 경로를 각자 재조립 → 하나만 놓쳐도 파일·레코드 불일치로 조용히 깨짐 | `utils/file.ts:80,137` / `file.service.ts:118,174` |
| 🟡 4 | **`FileTemp`에 소유 정보 없음.** `File.uploadedBy`도 항상 null | `file.service.ts:22` |
| 🟡 5 | **스토리지 혼선.** `moveFiles`는 S3 업로드, `getFileUrl`은 Azure SAS 발급 → production 파손 | `utils/file.ts:111` vs `:66` |

### 4-2. 경로 구조

```
resources/
  temps/<tenantId>/<filename>
  uploads/<tenantId>/<domain>/<newPath>/<filename>
```

`tenantId`를 `domain`보다 **앞**에 둡니다 — 테넌트 단위 백업·삭제·용량집계·이관이 단일 디렉터리로 끝납니다.
(`domains = ["terms", "daily-report"]`, 실호출처는 `terms.service.ts:151`·`daily-report.service.ts:71` 2곳)

### 4-3. 조치

1. **스키마**: `File.tenantId`(non-null, index), `FileTemp.tenantId`. `uploadedBy` 실제로 채우기
2. **경로 단일화**: `utils/file.ts`에 `buildStoragePath(tenantId, domain, newPath, filename)` 신설 → 중복 4곳 제거. `moveTempsToUploads`/`moveTempsToUploadsLocal` 통합 검토
3. **multer**: `getMulterOptions()`의 `destination` 콜백에서 ALS `tenantId` 취득 (미들웨어 실행 순서 검증 — Phase 3-2 의존)
4. **정적 마운트 제거 → 스트리밍 엔드포인트**
   ```
   GET v1/file/:fileId/raw → 가드 통과 → File.tenantId === ctx.tenantId → sendFile / blob stream pipe
   ```
   `getFileUrl`은 이 엔드포인트 URL을 반환.
   효과: ⓐ 격리가 가드 한 곳에서 강제 ⓑ 프론트 LOCAL/CLOUD 분기 소멸 ⓒ `entities/file`의 `useFileUrl`이 SAS 60분 만료 때문에 `staleTime` 30분으로 묶여 있던 제약 해소
5. **프론트**: `apps/web`·`apps/admin` 양쪽 `entities/file` (`useFileUrl`, `PhotoImage`) 대응
6. **이관 스크립트**: `uploads/<domain>/...` → `uploads/<default-tenant>/<domain>/...` 이동 + `File.localPath`/`cloudPath` 일괄 UPDATE
   - ⚠️ **디스크 이동과 DB UPDATE는 원자적이지 않음** → 롤백 경로 + dry-run 필수
   - ⚠️ Azure Blob은 rename이 없어 copy+delete → 실패 시 중복 과금 주의

| 세부 | 공수 |
|---|---:|
| `File`/`FileTemp` `tenantId` + 마이그레이션 | 0.5d |
| `buildStoragePath` 단일화 | 0.5d |
| multer ALS 연동 + 순서 검증 | 0.5d |
| `getFileUrl` 테넌트 검증 | 0.5d |
| **정적 마운트 제거 → 스트리밍 컨트롤러** (Range, Content-Type/Disposition) | 1.5d |
| 프론트 `entities/file` 2개 앱 | 0.5d |
| 기존 파일 이관 스크립트 + 롤백 | 1.0d |
| temp 정리 배치 bypass | 0.25d |
| 격리 e2e (A토큰 → B파일 차단) | 0.75d |
| | **6.0d** |

> 별도: S3/Azure 혼선 정리(#5) **+0.5d** — 테넌트 작업과 독립이나 같이 처리 권장

---

## Phase 5 — 프론트엔드 (`apps/web`, `apps/admin`)

### 5-1. `apps/web` 서브도메인 라우팅

- `apps/web/src/middleware.ts` **신규** (현재 web·admin 모두 middleware 파일 없음)
- `[subdomain].domain.com/path` → 내부 rewrite `/tenants/[subdomain]/path` (URL 유지)
- 앱 라우트를 `app/tenants/[subdomain]/` route group으로 이동 — 9개 page + `(home)`/`(checkauth)` 레이아웃
- ⚠️ CLAUDE.md §8 "`(checkauth)/layout.tsx` 수정 금지" — 이 Phase는 예외적으로 수정 필요, **작업 전 사용자 확인 필수**

### 5-2. `apps/admin` 역할 분기

- admin은 서브도메인 대신 **단일 도메인 + role 라우팅** (단순성 우선)
- `SUPER_ADMIN`(전체 관리) vs `TENANT_ADMIN`/`STAFF`(자기 매장) 분기
- 기존 `(checkauth)` SSR 가드 확장, `widgets/sidebar` 메뉴 role별 필터링
- 11개 page 접근 제한 재검토

### 5-3. 쿼리 캐시 테넌트 반영 (v2 신규)

- `shared/libs/axios/instance.ts`에 `X-Tenant-Id` 헤더 주입 (web·admin 양쪽)
- **44개 훅(web 16 / admin 28)의 쿼리키에 tenant 반영** — 미반영 시 테넌트 전환·SUPER_ADMIN 뷰에서 캐시 오염
- `usePaginatedList`/`useInfiniteList` 키 생성부에서 공통 처리 권장

### 5-4. 테넌트 온보딩 화면 (신규 개발)

- 테넌트 가입/생성, 서브도메인 선택, 초기 TENANT_ADMIN 계정 발급
- ✅ job-030 에서 구현 완료 — `POST v1/tenants/onboard` / `GET v1/tenants/subdomain-availability`
  (`apps/api/src/tenant/`), `apps/admin` `(home)/auth/onboarding` 화면

### 5-5. 로컬 DX

- `lvh.me` / `*.localhost` / hosts 세팅 문서화
- docker-compose 및 `ALLOWED_ORIGINS` 와일드카드 서브도메인 대응 (현재 `app.setup.ts:43`은 콤마 분리 정확 매칭)
- ✅ job-030 에서 구현 완료 — 상세: [`docs/local-tenant-dev.md`](./local-tenant-dev.md)

| 세부 | 공수 |
|---|---:|
| web 서브도메인 rewrite + 라우트 이동 | 2.0d |
| admin role 분기 | 2.0d |
| `X-Tenant-Id` 주입 + 44훅 쿼리키 | 1.0d |
| 테넌트 온보딩 화면 | 1.5d |
| 로컬 DX | 0.5d |
| | **7.0d** |

---

## Phase 6 — 검증

- **테넌트 격리 e2e (필수)**: A 토큰으로 B 데이터 조회/수정/삭제 차단
- **중첩 관계 누출 테스트**: A 토큰으로 B 리소스 `include` 시 미노출 (RLS 방어 증명)
- **파일 격리**: 정적 경로 직접 접근 차단, 타 테넌트 `fileId` 접근 차단
- Phase 0 특성화 테스트 전량 그린 확인 (생략했다면 주요 플로우 수동 회귀)
- 전체 `type-check` + `lint`
  - ⚠️ `pnpm --filter <app> exec tsc --noEmit`는 web·admin에서 `i18n/locales` 관련 **기존** TS6307로 실패 → `| grep -v "i18n/locales"`로 필터

| 세부 | 공수 |
|---|---:|
| 격리 e2e (데이터 + 중첩 누출) | 2.0d |
| 회귀 검증 | 1.5d |
| type-check/lint/빌드 정리 | 0.5d |
| | **4.0d** |

---

## 공수 총계

| Phase | 내용 | 공수 |
|---|---|---:|
| 0 | 안전망 (특성화 테스트) | 2.0d |
| 1 | DB 스키마 & RLS | 4.5d |
| 2 | RBAC 4-role | 1.5d |
| 3 | 백엔드 테넌트 파이프라인 | 7.5d |
| 4 | 파일 스토리지 격리 | 6.0d |
| 5 | 프론트엔드 | 7.0d |
| 6 | 검증 | 4.0d |
| | **합계** | **32.5d** |
| | Phase 0 생략 시 | 30.5d |
| | S3/Azure 정리 포함 | +0.5d |

- **1인**: 버퍼 20% 포함 약 **39d ≒ 7~8주**
- **2인 병렬**(백엔드/프론트 분담): 약 **4~5주** — Phase 3 완료 전엔 Phase 5 통합 테스트가 불가하므로 완전 병렬은 아님

### 의존 관계 / 진행 순서

```
Phase 0 ─┐
         ├→ Phase 1 → Phase 2 → Phase 3 ─┬→ Phase 4 ─┐
         │                                │           ├→ Phase 6
         └────────────────────────────────┴→ Phase 5 ─┘
```

- Phase 4는 Phase 3-2(미들웨어 순서) 확정 후 착수
- Phase 5는 Phase 2(role 상수) 확정 후 UI 골격 선행 가능, 통합은 Phase 3 이후

---

## 축소 옵션 (MVP/데모용, 약 12~14d)

| 조치 | 절감 | 대가 |
|---|---:|---|
| RLS 생략, Extension 자동 주입만 | −2.5d | raw/nested 우회 리스크. 추후 추가는 additive라 가능 |
| 서브도메인 라우팅 생략 (`X-Tenant-Id` 헤더만) | −3.0d | 프론트 라우트 이동·로컬 DX 세팅 전부 제거 |
| 정적 마운트 유지, 경로에만 tenantId | −1.5d | **인증 없는 다운로드 경로 잔존 — B2B 계약·보안심사 리스크. 비권장** |
| 역할 3단계 (`STAFF` 보류) | −0.5d | 현장 스태프 권한 분리 불가 |
| 결제 주체 이동 보류 (`UserSubscription` 유지 + `tenantId`만) | −1.5d | B2B 과금 모델 가면 결국 해야 함 |
| Phase 0 생략 | −2.0d | 144곳 리팩터 회귀를 수동으로 감당 |

---

## 리스크

| 리스크 | 대응 |
|---|---|
| Prisma Extension 우회 (중첩 write / raw) | **RLS 필수 병행** (Phase 1-4) |
| 배열형 트랜잭션 21곳에서 RLS 미적용 | 인터랙티브 전환 (Phase 3-3) — **누락 시 조용히 격리 실패** |
| 정적 마운트로 인한 파일 유출 | 마운트 제거 + 스트리밍 엔드포인트 (Phase 4-3) |
| 닭-달걀 (온보딩/로그인 시 테넌트 미확정) | 미들웨어 **allowlist** |
| SUPER_ADMIN 기능 마비 | escape hatch (`runWithoutTenant` + bypass) |
| 기존 데이터 non-null 전환 실패 | nullable → 백필 → non-null 3단계 |
| 파일 이관 중단 시 파일·DB 불일치 | 롤백 스크립트 + dry-run 모드 |
| 테스트 부재로 회귀 미탐지 | Phase 0 선행 |
| `dist` 미리빌드로 스테일 타입 | 스키마/shared 변경 후 `pnpm --filter @pawlog/{database,shared} build` |
| 프론트 서브도메인 DX | 로컬 `lvh.me` 세팅 문서화 |

---

## 미결 결정 사항

착수 전 확정 필요:

1. **RLS 병행 여부** — 권장: 병행 (Extension 단독은 우회 가능)
2. **테넌트 식별 방식** — 권장: 서브도메인 + 헤더 폴백 / 축소 시 헤더 단독
3. **정적 마운트 처리** — 권장: 제거 후 스트리밍 (유지 시 격리 불가)
4. **구독 주체 이동 시점** — 권장: Phase 1에 포함 (나중에 하면 중복 작업)
