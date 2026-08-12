# Project Rules (Agent Guidelines)

## 1. Reuse First

- Check: `@pawlog/shared` (types/utils) -> `@pawlog/ui` (shadcn components) -> `@pawlog/database` (prisma client/types).
- Do not build local components/helpers if they exist in packages.
- Always use `@pawlog/ui` components (`Button`, `Input`, `Label`, `Card`, `Field`, etc.) instead of raw HTML tags. Add generic logic to `@pawlog/shared`.

## 2. API Contracts

- Define request/response types in `packages/shared/types/contracts/<domain>.ts`.
- **API**: NestJS DTO must `implements` the request type:
  ```ts
  import type { CreateOrderRequest } from "@pawlog/shared";
  export class CreateOrderDto implements CreateOrderRequest {}
  ```
- **Web**: Import contract types for payloads and responses (`BaseResponse<T>`).
- **관계(include)를 실은 응답 타입은 손으로 쓰지 말고 Prisma 에서 유도할 것** (job-044):
  ```ts
  // ❌ 손으로 쓴 모양 — 스키마가 nullable 로 바뀌어도 따라가지 않는다
  export interface PetWithOwner extends Pet { user: { email: string; nickname: string } }
  // ✅ 스키마에서 유도 — nullable 여부가 자동으로 따라붙는다
  export type PetWithOwner = Prisma.PetGetPayload<{
    include: { user: { select: { email: true; nickname: true } } };
  }>;
  ```
  실제로 `Pet.userId` 를 nullable 로 바꿨을 때 손으로 쓴 쪽이 non-nullable 로 남아, **타입 검사는 통과하고 런타임만 깨졌다** — 계정 미연결 원생이 있는 매장에서 `pet.user.nickname` 이 TypeError 를 내며 원생 목록·리포트 작성 화면이 통째로 렌더 실패했고, SSR 은 200 이라 서버 로그에도 남지 않았다. 이 부류는 상태 코드로 잡히지 않으니 **계약이 진실인지가 유일한 방어선**이다.
  - 부득이 손으로 쓴다면, Prisma 스키마의 nullable 변경 시 `packages/shared` 계약을 **반드시 같이** 고칠 것.
- **Versioning**: All API routes must include a version prefix (e.g., `v1/admin`, `v1/auth`, `v1/payments`, `v1/subscriptions`). When upgrading an API to a new version (e.g., `v2`), keep the older version active without deleting it to maintain service stability.

## 3. Pagination

- **Backend (NestJS)**: Use `PaginationQueryDto`. In services, use `resolvePagination` and return `buildPaginatedData`:
  ```ts
  const { page, pageSize, skip, take, order } = resolvePagination(query);
  const [items, total] = await prisma.$transaction([
    prisma.x.findMany({ where, skip, take, orderBy: { createdAt: order } }),
    prisma.x.count({ where }),
  ]);
  return buildPaginatedData(items, { page, pageSize, total });
  ```
- **Frontend (Next.js)**: Call `GetList` (not `Get`) in `request.ts`. For UI state, use `usePaginatedList<T>` or `useInfiniteList<T>`. Do not manage pagination state via `useState`/`useEffect`.
  ```tsx
  const { data, isLoading } = usePaginatedList<Order>(
    "orders",
    "/payments/orders",
    { page },
  );
  ```

## 4. `@pawlog/shared` Contents

- Responses: `BaseResponse`, `BasicResponse`, `ErrorResponse`, `HttpError`
- Contracts: `LoginRequest`, `SubmitOtpRequest`, `RefreshRequest`, `LoginResponse`, etc.
- Pagination: `PaginationQuery`, `NormalizedPagination`, `PaginationMeta`, `PaginatedData<T>`, `resolvePagination`, etc.
- Entities: `BaseEntity`, `AsCreateRequest`, `AsUpdateRequest`.

## 5. RBAC — Two Tiers (job-033)

Roles live at **two levels**. Getting this wrong is the most common source of 403s.

| Tier | Stored in | Values | Meaning |
| ---- | --------- | ------ | ------- |
| Platform | `User.role` | `USER` \| `SUPER_ADMIN` | What the *account* is. `USER` is everyone; `SUPER_ADMIN` is pawlog staff and belongs to no tenant. |
| Tenant | `TenantMembership.role` | `GUARDIAN` \| `STAFF` \| `TENANT_ADMIN` | What you are **inside one store**. One user can hold different roles in different tenants. |

- **The JWT carries only `userId`/`email`/`role`(platform)** — never `tenantId`. A user may belong to many tenants, so a token cannot name one.
- The **active tenant** comes from the request: Host subdomain → `X-Tenant-Id` header. `TenantMiddleware` resolves it, verifies the caller has an **ACTIVE** membership there, and puts `{ tenantId, role }` on `req.tenantMembership`.
- `RolesGuard` computes the **effective role**: `SUPER_ADMIN` (platform) → else `req.tenantMembership.role` → else `USER` (no active tenant = personal scope, e.g. my profile / my pets).
- Guards: `JwtAccessGuard` (auth) → `RolesGuard` (roles). `@Public()` bypasses both.
- Restrict endpoints with `@Roles(...)` as before — the decorator is unchanged, only how the effective role is derived. **`SUPER_ADMIN` does not implicitly inherit tenant roles**: list it explicitly (`@Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)`), which is what every existing controller does.
- Routes that must work **without** a tenant (signup, "my pets", "my memberships", opening a store) must **not** carry `@Roles` for a tenant role — the effective role there is `USER`.
- Endpoint families map to apps (job-038): `v1/platform/*` → `apps/admin` (SUPER_ADMIN, never tenant-scoped) · `v1/admin/*` + `v1/memberships` + `v1/attendances` + `v1/daily-reports` → `apps/web` under `/tenant/[tenant]/…` · personal routes (`v1/pets`, `v1/auth/me`, `v1/memberships/mine`) → `apps/web` outside the tenant gate.

## 6. Conventions

- Module Layout: `routes/` · `dtos/` · `controllers/` · `services/`.
- Redis: Used for auth tokens/OTP (`apps/api/src/shared/redis`).
- Response: Wrapped in `BaseResponse<T>` (`{ result, message, data }`) by `TransformInterceptor` automatically. **The interceptor never inspects the payload** — the service/controller return value becomes `data` verbatim (so a payload may safely contain a `message` field).
  - **Success message**: set it on the route, not in the payload. Static → `@ResponseMessage("...")` decorator on the controller method. Runtime-varying → return `new ResponseEnvelope(payload, message)` from the service. No decorator/envelope ⇒ default `"요청 성공"`.
  - **Do not** return `{ message, ...data }` from services/controllers and **do not** hand-build a full `{ result, message, data }` — let the interceptor wrap. Error responses are shaped separately by `HttpErrorFilter` (`result: false`).
- Error Typing: The common API error type is declared once in `global.d.ts` as `ApiError = AxiosError<BaseResponse<unknown>>` (via `declare global`), and React Query's `defaultError` is augmented to `ApiError`. Both `apps/web` and `apps/admin` share this pattern — keep the two `global.d.ts` files in sync.
  - **React Query callbacks/props** (`onError`, the returned `error`, `throwOnError`, …): the error is **auto-inferred as `ApiError`**. Rely on inference — never use `any` or re-annotate. This applies to every new API you add, as long as it's called through a `useMutation`/`useQuery` hook (see §7).
  - **Explicit annotations** (e.g. an interceptor's `refreshAccessToken(error: ApiError)` or a `.catch((err: ApiError) => …)`): use the `ApiError` alias, not the raw `AxiosError`. `AxiosError` should appear only inside the `ApiError` definition in `global.d.ts`.
  - **Raw `try/catch`**: the caught variable is always `unknown` (TS `strict`) — the augmentation does **not** apply. Narrow it with the runtime guard `axios.isAxiosError(error)` before touching `error.response`; do not cast with `as`. Prefer wrapping the call in a mutation/query hook so you land on the auto-inferred path instead.

## 7. Frontend Architecture (FSD)

`apps/web` and `apps/admin` follow **Feature-Sliced Design**. Layers (import direction is one-way, top imports from bottom only):

`app/` (Next.js routes) → `views/` (pages) → `widgets/` → `features/` → `entities/` → `shared/`

- **Never import upward or sideways** (a `feature` must not import a `widget`; two `features` must not import each other). Share via `entities/` or `shared/`.
- **Slice layout**: each slice is `<slice>/{model,ui,lib}` with an `index.ts` barrel as its **public API**. Import slices through the barrel only: `@/features/auth/login`, `@/entities/user`, `@/widgets/users-table` (`@/` = `src/`).

Layer responsibilities:

- **`app/`**: routing, layouts, providers, SSR auth guards. Pages (`page.tsx`) stay thin — delegate to a view: `export default function Page() { return <UsersPage />; }`.
- **`views/`**: page composition only. **No data fetching, no form logic, no business logic** — compose widgets/features and lay out the page.
- **`widgets/`**: self-contained page blocks (e.g. a list table). Own their own list query + pagination/search state via `usePaginatedList`. Compose entities + features.
- **`features/`**: a single user interaction (login, change-role, create-terms). `model/` holds the hook (`useMutation`/`useQuery`), `ui/` holds the component.
- **`entities/`**: business-domain display/model — types (`model/`), pure helpers (`lib/`), presentational pieces like badges (`ui/`).

Data & forms (enforced):

- **Never call raw `Post`/`Get`/`Patch` inside a view/page component.** Wrap every mutation in a `useMutation` hook inside a feature `model`; `onSuccess` invalidate the related query key and `toast` feedback.
  ```ts
  // features/membership/manage-member/model/useUpdateMemberRole.ts
  export const useUpdateMemberRole = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, role }: { id: string; role: string }) =>
        Patch(`/v1/memberships/${id}/role`, { role }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["memberships"] }),
    });
  };
  ```
- **`invalidateQueries` 가 듣게 하려면 `refetchOnMount` 를 끄지 말 것** (job-054). 무효화는
  *활성(마운트된)* 쿼리만 다시 부르고 비활성 쿼리에는 stale 표시만 남긴다. "작성 화면 →
  목록 화면" 처럼 라우트를 옮기는 흐름에서는 뮤테이션이 도는 순간 목록이 언마운트 상태라,
  그 표시를 실제 갱신으로 바꾸는 지점이 **마운트 시 재조회** 하나뿐이다. 캐싱이 필요한
  쿼리는 각자 `staleTime` 을 선언한다(기본은 "항상 최신", 캐싱은 opt-in).
- **Forms** use `react-hook-form` (`useForm`) for input state and delegate submit to the feature's mutation hook. Do not hand-roll `useState` for field/error/loading.
- **Lists** use `usePaginatedList` in a widget (see §3); render rows/badges from `entities`.

## 8. App Boundaries & Routing (job-038)

### Which app does a screen belong to?

The two Next.js apps are **not** "one for stores, one for the platform operator's convenience" — the split is by *whose data it is*.

| App | Audience | Contains |
| --- | -------- | -------- |
| `apps/web` | **Every member** — guardians, staff, store admins | Personal screens (my pets, my reports, my stores) **and** all store operations (`/tenant/[tenant]/…`) |
| `apps/admin` | **Platform operator only (`SUPER_ADMIN`)** | Tenants, platform-wide members/subscriptions, terms, plans, system health |

A store admin never opens `apps/admin`. If a screen is scoped to one store, it belongs in `apps/web` under `/tenant/[tenant]/`.

### `apps/web` route structure

```
src/app/(home)/
├── layout.tsx                     # providers only — no auth check
├── auth/login/                    # 🔓 public (Kakao only, job-036)
├── page.tsx                       # 🔓 landing
├── r/[token]/                     # 🔓 공개 알림장 (알림톡 링크, job-040)
├── welcome/                       # 🚪 약관 게이트 (job-041) — 로그인 필요하지만
│                                  #    (checkauth) **바깥**: 안에 두면 무한 리다이렉트
└── (checkauth)/                   # ✅ logged in
    ├── layout.tsx                 # SSR getMe → redirect; feeds memberships to TenantSync
    │                              #    + 필수 약관 미동의면 /welcome (job-041)
    ├── launch/                    # 🎯 로그인 착지점 (job-042) — 운영 매장 1개면 직행,
    │                              #    여럿이면 고르기, 없으면 /app
    ├── app|pet|reports|subscriptions|tenants|onboarding|profile|feed/   # personal scope
    └── (tenantAuth)/
        └── tenant/[tenant]/       # 🏪 store scope — [tenant] is the tenant's subdomain
            ├── layout.tsx         # SSR gate (see below)
            └── attendance|daily-reports|pets|members|users|subscriptions/
```

### The `(tenantAuth)/tenant/[tenant]` gate

`(checkauth)` asks "are you logged in". `(tenantAuth)/tenant/[tenant]` asks **"can you actually use *this* store"**, and passes only if all three hold:

1. the caller has a membership in the tenant whose `subdomain === params.tenant` — otherwise **`notFound()`**, deliberately, so the existence of other stores is never revealed;
2. that membership is `ACTIVE` (a pending application does not get in);
3. `tenant.isActive` (a store suspended for non-payment is excluded).

**The URL is the source of truth for the active tenant** — not `localStorage`. That is what makes store links shareable, lets one person keep two stores open in two tabs, and leaves a clean path to real subdomain routing later (`acme.pawlog.com/pet` ≡ `/tenant/acme/pet`). The layout hands the resolved id to `TenantRouteSync`, which writes it to the store so the axios interceptor can send `X-Tenant-Id`; on unmount it clears it, otherwise personal screens stay scoped to the store and look empty.

The fixed `tenant/` prefix is what keeps store addresses out of the top-level namespace. Without it, a store whose subdomain is `pet` was permanently unreachable — Next.js matches the static `/pet` (my pets) first — so every new top-level route had to be added to `RESERVED_SUBDOMAINS` (`apps/api/src/shared/utils/tenant.ts`). **That obligation is gone**; the list is kept as a defensive/naming convention only (see the comment on the constant).

### Rules

| Situation | Placement |
| --------- | --------- |
| Public (login, landing) | `(home)/auth/<page>/` or `(home)/<page>/` |
| Logged in, not about one store (my pets, my stores, open a store, my profile) | `(home)/(checkauth)/<feature>/` |
| Scoped to one store (attendance, reports, members, students) | `(home)/(checkauth)/(tenantAuth)/tenant/[tenant]/<feature>/` |
| Platform-wide operation | `apps/admin` — never `apps/web` |

### Guidelines

1. **Keep pages thin** — `page.tsx` calls one view (see FSD §7).
2. **No client-side guards in `page.tsx`** — the layouts guard.
3. **Layout guards are UX, not security.** Real enforcement is per-request: `TenantMiddleware` (membership check) + `RolesGuard` (effective role). Never rely on a layout to protect data.
4. **Do not modify `(checkauth)/layout.tsx` or `(tenantAuth)/tenant/[tenant]/layout.tsx`** without confirming with the user — they define who gets in.
5. **Links inside `/tenant/[tenant]/…` must carry the segment**: read it with `useParams<{ tenant: string }>()` and build the href with `tenantPath()` from `@/shared/libs/tenant/routes` — never hand-concatenate. A bare `/daily-reports` drops the store context and 404s.
6. **All store URLs go through `tenantPath(subdomain, ...segments)`** (`apps/web/src/shared/libs/tenant/routes.ts`), which owns the `/tenant` prefix. `replaceTenantInPath()` swaps only the store segment — a plain string replace can hit the `/tenant` prefix first (e.g. a store whose subdomain is `ten`).

## 9. Pre-implemented Modules — Reuse Before Building

The following modules are **already fully implemented** in `apps/api`. Before writing any new service, controller, or endpoint, check whether the job is covered by one of these modules and **reuse it** instead of re-implementing the logic.

> Swagger reference: `http://localhost:3000/api/template-dev/docs`

| Module           | Source path                  | Base route         | Endpoints / Responsibility                                                                                        |
| ---------------- | ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **health**       | `apps/api/src/health/`       | `GET v1/health`    | DB + Redis liveness check                                                                                         |
| **auth**         | `apps/api/src/auth/`         | `v1/auth`          | Kakao OAuth (the only login path in `apps/web`) · Signup/Login (kept for `apps/admin` + e2e) · Logout · Refresh · Mypage (**returns memberships**) · `PATCH me` (nickname/phone → re-claims invitations) |
| **terms**        | `apps/api/src/terms/`        | `v1/terms`         | Terms list & user agreement submission (`v1/terms/agreements`)                                                    |
| **payment**      | `apps/api/src/payment/`      | `v1/payments`      | Order creation · Payment confirmation · Cancel/Refund · Toss webhook · Order lookup                               |
| **subscription** | `apps/api/src/subscription/` | `v1/subscriptions` | Subscription plans · Billing-key registration · Subscribe · Cancel · My subscription                              |
| **file**         | `apps/api/src/shared/file/`  | `v1/file`          | 다중 임시 업로드(`POST v1/file/upload`) · 접근 URL 조회(`GET v1/file/:id`) · 원본 스트리밍(`/raw`). **파일의 소유 테넌트는 `FileOwnership` 으로 정한다 — job-055** |
| **tenant**       | `apps/api/src/tenant/`       | `v1/tenants`       | Subdomain check + public store directory (`@Public()`) · Onboarding (auth + 개설권 필요) · Tenant list/detail/update/suspend (`@Roles(SUPER_ADMIN)`) |
| **membership**   | `apps/api/src/membership/`   | `v1/memberships` · `v1/invitations` | Guardian apply → admin approve/reject · member role change / remove · invitations incl. **pre-registering people who have no account yet** (`createForExistingPet` 은 이미 만든 원생을 가리키는 자리표시자 — 가입 시 새로 만들지 않고 **연결**한다) |
| **platform**     | `apps/api/src/platform/`     | `v1/platform`      | **SUPER_ADMIN only, never tenant-scoped**: all-platform member list/detail, suspend, delete, SUPER_ADMIN grant/revoke, platform-wide seat-subscription list |
| **platform-subscription** | `apps/api/src/subscription/` | `v1/platform-subscriptions` | 매장 개설권 (SaaS seat): plans · user-owned billing key · subscribe · my entitlements · cancel |
| **pet**          | `apps/api/src/pet/`          | `v1/pets`          | Owner-facing pet CRUD · enroll/unenroll. 매장 측 등록은 **`v1/admin/pets/intake`(단일 진입점)** — job-040 |
| **care**         | `apps/api/src/care/`         | `v1/attendances` · `v1/daily-reports` | Check-in/out & attendance · **등원 되돌리기 `POST v1/attendances/:id/undo-check-in`(상태 + 이용권 차감을 함께 되돌린다, job-052)** · Daily reports + nested report contents · AI comment draft · **공개 알림장 `GET v1/daily-reports/shared?token=`(`@Public()`)** |
| **notification** | `apps/api/src/notification/` | `v1/notifications` | Solapi 알림톡/SMS dispatch + `NotificationLog` history · daily reminder cron                                       |
| **feed**         | `apps/api/src/feed/`         | `v1/feed`          | 사진 1장 → 태그된 아이의 보호자에게 팬아웃 · AI 태그 제안/캡션 초안 · 태그 수정 학습 로그 · 초상권 동의 검사 · 오늘 사진 0장 커버리지 · 하루 마감(Claude 로 아이별 알림장 생성 → DailyReport) · 보호자 피드(`mine`) |
| **llm**          | `apps/api/src/shared/llm/`   | (내부)             | Claude API 얇은 래퍼(`ClaudeClientService`). **실패·미설정 시 예외 대신 `null`** 을 돌려주므로 호출부가 규칙 기반으로 폴백한다. 동시성 상한 헬퍼 `mapWithLimit` 포함. 설정은 `shared/configs/anthropic.config.ts` |


## 10. Prisma Schema Changes — Never `db push`, Always a Committed Migration

Every change to `packages/database/prisma/schema/*.prisma` (new column, rename, drop, etc.) **must generate a migration file and commit it**. Breaking this rule produces a bug class that's very hard to catch: >

- **Why it doesn't break in dev**: `prisma db push` (or an equivalent auto-sync) immediately ALTERs the connected database to match `schema.prisma`. With no migration file needed, the dev DB is already up to d>
- **Why it breaks in production**: the container's boot script runs `prisma migrate deploy`, which never looks at `schema.prisma` at all — it only replays the SQL files already committed under `packages/databa>


### Rules

1. **Check first**: Before scaffolding a new module, verify whether the task relates to auth, payments, subscriptions, terms, file upload, or health. If it does, extend the existing module rather than creating a new one.
2. **Extend, don't duplicate**: Add new endpoints inside the existing module's `controllers/` and `services/` following the same `routes/v1/` → `controllers/` → `services/` layout (see §6 Conventions).
3. **Route constants**: Always define new paths in the module's `routes/v1/index.ts` route-constant file; never hardcode path strings in controllers.
4. **Admin variants**: Admin-only endpoints for the above domains live in `apps/api/src/admin/`. Check there as well before adding admin logic.
   매장 운영 화면이 쓰는 것들(job-052): `GET v1/admin/dashboard`(오늘 5블록, `DashboardService`) · `GET v1/admin/pets/summary`(원생 필터 칩 개수) · `GET v1/admin/pets`(오늘 출석 + 정기권 잔여 포함, **픽업 시각 순 기본 정렬**).
   ⚠️ `pets/summary` 는 고정 경로라 컨트롤러에서 `pets/:id` 보다 **먼저** 선언되어야 한다.

---

## Project Status

- Branch: `main`. Completed through **job-052 (2026-08-06): 디자인 시스템 전면 재구성 + 원생 안전정보 구조화** — 아래 요약 참조. Prior: job-043 (2026-08-05): **전화번호 표기 통일** + job-042 **로그인 착지점 라우팅** + job-041 **최초 진입 게이트(약관 동의 + 전화번호)** + job-040 **가입하지 않은 보호자도 원생이 되고 알림톡을 받는다** — 아래 요약 참조. Prior: job-034 **피드(사진 기반 알림장) MVP** — `plan.md` 기획의 핵심 축. Prior state (job-001~033): landing page 로그인 게이팅, app boundary split (`apps/admin` = SUPER_ADMIN platform console, `apps/web` = every store-scoped + personal screen), membership-based multi-tenancy, Kakao-only auth for `apps/web`.
- `apps/web` **프로덕션 빌드 성공** (`next build`) — 모든 라우트 컴파일 확인(`/welcome`, `/launch`, `/r/[token]`, `/tenant/[tenant]/*` 포함).
- **역할별 플로우 테스트 59건 전부 통과** (`role-flow.sh`): ① 원장 — 개설권 없이 개설 403 → 개설권으로 개설 → TENANT_ADMIN 부여 → 2호점 차단 → 매장 직행 → 원생 등록 → 등하원 → 알림장 발행/알림톡 → 알림 이력 → 가입 승인. ② 보호자 — 소셜 미동의 상태 → 게이트가 `/app`·`/pet`·`/launch` 전부 가로챔 → 동의+번호로 아이 연결 → `/app` 착지 → 내 아이/알림장 → 로그인 없이 공개 링크 열람. ③ 스태프 — 출석·알림장·피드는 되고 원생/구성원/알림이력/회원목록은 403. ④ 경계 — 보호자가 매장 API 전부 403(`feed/mine` 만 예외), 소속 없는 회원 403, 다른 매장 원장 403 + 테넌트 격리, 플랫폼 API 는 원장도 403.
- job-043 검증: 스모크 15건 전부 통과 — 회원 번호·게이트·펫(보호자/원장 양쪽)·비상연락처·픽업 담당자·초대장까지 **하이픈을 넣어 보내도 전부 숫자만 저장**, 하이픈으로 조회해도 같은 사람 매칭, 세 테이블 전수 점검에서 숫자 아닌 번호 0건.
- job-042 검증: 스모크 13건 전부 통과 (소속 0 → `/app` · 운영 매장 1 → `/tenant/<sub>` 직행 · 2개 → 200 고르기 화면에 두 매장 링크·역할 라벨 · GUARDIAN 소속은 `/app` · 정지 매장/PENDING 제외 · **약관 게이트가 `/launch` 보다 먼저** · `successRedirect` = `/launch`).
- job-041 검증: 스모크 21건 전부 통과 (소셜 계정의 미동의 상태 집계 → 빈/부분/`isAgreed=false` 동의 400 → **동의 실패 요청에 실린 번호가 저장되지 않음** → 번호 없이 통과 → 번호와 함께 통과 시 아이 연결·중복 없음 → 재제출 시 동의 로우 미증가). 브라우저 리다이렉트는 쿠키를 붙여 직접 확인: 미동의 상태에서 `/app`·`/pet` → 307 `/welcome`, `/welcome` → 200; 동의 후 `/app`·`/pet` → 200, `/welcome` → 307 `/app`.
- job-040 검증: dev 컨테이너 대상 **엔드투엔드 스모크 2종 전부 통과** — ① 원생 등록 단일 진입점 30건(미가입 판정 → 계정 없이 등록 → 등원 체크·알림 로그 → 보호자 가입 시 **중복 없이 연결** → 재조회 노출 → 보호자가 등록한 아이를 원장이 선택 → 타인 아이/중복/조합 오류 차단 → 구성원 아닌 회원의 아이 목록 비공개 → `createPet` 403) ② 공개 알림장 링크(알림 본문의 `/r/` 링크 → 인증 없이 200 → 개인정보 미포함 → 서명 변조·위조 payload 거절 → DRAFT 미발송 → `/r/<token>` SSR 200). 스크립트는 세션 스크래치패드에 있고 리포지토리에는 커밋하지 않았다 — **jest e2e 스펙으로 옮기는 것이 남은 일**이다.
- `tsc --noEmit`, `lint` clean on all touched files in `apps/api`, `apps/web`, `packages/*`; pre-existing unrelated i18n `tsc` errors (`apps/web/.../locales/*/index.ts` JSON includes) and the pre-existing `apps/api/test/auth.e2e-spec.ts:85` error untouched. Feed 도메인은 dev 컨테이너 대상 **엔드투엔드 스모크 테스트로 검증** (가입 → 원생 등록 → 사진 업로드 → 태그 제안 → 초상권 위반 차단 → 발행/팬아웃 → 커버리지 → 출석 자동 생성 → 하루 마감 → 보호자 피드 → 학습 로그/알림 로그). 새 화면은 SSR 200 렌더까지 확인했고, 브라우저 상호작용(카메라 입력·드래그) 검증은 못 했다 — 이 샌드박스에 headless Chromium 이 없다.
- Next: (0-a) **`TODO(job-042)` SMS OTP (Solapi)** — 전화번호 자기신고를 인증된 번호로 바꾼다. 지금은 남의 번호를 입력하면 그 아이의 알림장·사진에 접근할 수 있는 상태다(의도된 유예). (0-b) 알림톡 **발신프로필·템플릿 사전심사** (`NotificationLog.type` 4종 단위). 심사 전에는 SMS 폴백으로만 나간다. (0-c) 스모크 3종(intake / 공개 링크 / 게이트) → jest e2e 이관. (0-d) `TODO(job-041)` 이용권 단위(회원 vs 아이) 결정. (0-e) 카카오 `phone_number` scope (비즈앱 심사) — 통과하면 게이트에서 번호를 물어볼 필요가 없어진다.
- Next (job-034 관련): (1) **실제 API 키로 하루 요약 출력 품질 확인** — 코드 경로는 검증됐지만 이 샌드박스에 키가 없어 실제 생성 문장을 못 봤다. 프롬프트는 `FeedCaptionDraftService.DIGEST_SYSTEM_PROMPT`. (2) 캡션 LLM 연결 — `FeedCaptionDraftService.generateCaption` 의 `// TODO(llm)`. 비전 호출이라 사진이 외부로 나가므로 초상권 판단이 함께 필요하다. (3) 얼굴 인식 — `FeedTagSuggestionService` 의 `// TODO(vision)`, LLM 이 아니라 임베딩+최근접 문제이므로 별도 Python 서비스가 맞다. (4) 하루 마감 스케줄러 (현재는 원장이 버튼으로 실행) + Batch API 전환 시 요약 원가 절반. (5) 오프라인 업로드 큐 — 지금은 클라이언트 리사이즈 + 청크 분할 + 재시도까지만 있고, 앱을 닫았다 열었을 때 이어서 올리는 Service Worker 큐는 없다. (6) 피드 화면 브라우저/e2e 커버리지.

## Summary of current implementation status

- **펫 프로필 사진 404 수정 — 파일의 테넌트 소유권 (job-055, 2026-08-10)**: `/tenant/<sub>/pets` 에서 프로필 사진이 전부 깨져 보였다. 원인은 **파일의 테넌트는 업로드한 요청의 스코프로 정해지는데, 그 파일이 보이는 범위는 붙어 있는 엔티티의 테넌트가 정한다**는 어긋남이다. 보호자가 `/pet` 에서(개인 스코프) 사진과 함께 아이를 등록하면 `File.tenantId` 가 테넌트 없이(= seed 의 `default` 테넌트로) 찍히고, 나중에 원장이 그 아이를 원생으로 받으면 **펫의 `tenantId` 만 매장으로 바뀌고 파일은 그대로 남는다.** 그러면 `GET v1/file/:id` 가 Prisma Extension 의 스코프 주입(`where.tenantId`)에 걸려 404 — 파일은 디스크에 멀쩡히 있는데도.
  - **펫 사진은 테넌트 소유가 아니다.** `FileService` 에 `FileOwnership`(`"request"` | `"shared"`)을 두고, 펫 프로필은 `"shared"`(`tenantId = null`, 저장 경로 `resources/uploads/_shared/…`)로 승격한다. 등원/전학마다 파일 테넌트를 따라 옮기는 방법도 있지만 동기화 지점이 계속 늘고 **한 곳만 빠뜨리면 같은 404 가 재발한다** — 아이는 매장을 옮겨 다니므로 애초에 매장의 자료가 아니다.
  - ⚠️ 공유 파일의 `file.create` 는 반드시 `runWithoutTenant` 안에서 한다. Extension 은 **create 의 data 에도** ALS tenantId 를 주입해(`injectCreateData`) 명시한 `tenantId: null` 을 덮어쓴다 — 그러면 원장이 매장 화면에서 올린 사진만 조용히 매장 소유가 된다.
  - ⚠️ 승격 호출부가 5곳(보호자 등록/수정 · 원장 등록/수정 · intake)이라 옵션을 각자 넘기면 한 곳을 빠뜨린다. **`promotePetPhoto()`(`pet/services/pet.service.ts`) 하나로 모았으니 펫 사진은 반드시 이걸 쓴다.**
  - 읽기 경로(`getFileUrl`/`streamFile`)는 이제 `runWithoutTenant` 로 조회하고 `assertReadable` 이 권한을 본다: `tenantId = null` 은 어느 스코프에서든 허용 · bypass(개인 스코프/SUPER_ADMIN) 허용 · 그 외는 활성 테넌트의 파일만. 부수효과로 **크로스 테넌트 접근이 404 가 아니라 403** 이 된다(`streamFile` 은 원래부터 403이었고 이제 둘이 같다).
  - 마이그레이션 `20260810000000_pet_photo_not_tenant_owned` 는 DDL 없이 기존 펫 사진 행의 `tenant_id` 를 NULL 로 맞춘다(`local_path` 는 건드리지 않는다 — DB 의 경로가 실제 위치의 유일한 출처라 그대로 열린다).
  - 검증: 매장 스코프 조회/스트리밍 200 · 개인 스코프 200 유지 · 매장 소유 피드 사진은 다른 매장에서 403 · 매장 스코프에서 새로 올린 펫 사진이 `tenant_id NULL` + `_shared/` 경로로 저장됨 확인. 마이그레이션은 스크래치 DB 전체 재생 후 `migrate diff` **empty**. **브라우저 확인은 안 했다** — API 레벨까지만.
- **디자인 시스템 전면 재구성 (job-052, 2026-08-06)**: 외부 디자인 스펙(애견 유치원 ERP)을 코드에 반영. `docs/design-system.md` 전면 개정. **설계 제약이 전부 "젖은 손·한 손·현관에서 쓴다"에서 나온다** — 이 화면은 사무실 책상이 아니라 등하원 현관에서 쓰인다.
  - **토큰 단일 출처 `packages/ui/src/styles/tokens.css`** (Tailwind v4 라 `tailwind.config.ts`/`tokens.ts` 가 아니라 CSS `@theme` 이 설정이다). 팔레트를 딥 그린틸 primary + 애프리콧 caution + 웜 오프화이트 배경으로 교체하고 shadcn 시맨틱 이름에 연결해 **29개 화면을 한 줄도 고치지 않고** 새 팔레트를 입혔다. 대비는 전부 WCAG 실측으로 확인(배지 3레벨 8.82 / 5.33 / 5.05:1, 전부 AA 이상).
    - ⚠️ 스펙의 `secondary`(애프리콧)를 **`caution` 으로 개명**했다. 이 저장소에서 `--secondary` 는 이미 shadcn 의 중립 표면이라, 그대로 덮으면 `bg-secondary text-secondary-foreground` 가 전부 2.54:1 이 되어 **스펙 자신의 MUST NOT 을 어긴다.**
  - **타이포·굵기 스케일을 정의 자체에서 접었다.** `text-xs`→15px, `text-sm`→15px, `text-base`→17px … 그리고 `font-medium`/`font-bold`/`font-extrabold`→600. 화면 194곳이 12/14px 을 쓰고 있었는데 클래스를 갈아끼우면 또 갈라지므로(job-050 의 교훈) **토큰 정의를 고쳐** 손대지 않은 화면도 15px 하한과 400/600 규칙을 만족한다. 폰트는 Pretendard.
  - **터치 타겟 64px.** `Button` 기본값을 44→64px 로 올리고 `apps/web` 의 `size='sm'` 51곳을 제거했다. `sm`(48px)은 데스크톱 콘솔(`apps/admin`) 표 전용으로 남긴다. **커 보이는 게 아니라 젖은 손에서 44px 는 안 눌린다.**
  - **인터랙션 규칙을 코드로 강제** — `shared/ui` 에 `BottomSheet`(상세는 페이지 이동이 아니라 시트, 최상단 보호자 전화 걸기)·`SegmentedControl`(칩 48px/히트 64px)·`QuickActionBar`(하단 고정 최대 3개)·`useUndoToast`(8초 되돌리기) 신설.
    - ⚠️ **되돌리기는 화면만 되돌리는 게 아니다.** 등원 체크는 회수권을 1회 깎고 알림톡을 보낸다. 그래서 `POST v1/attendances/:id/undo-check-in` 을 신설해 **상태와 차감을 함께** 되돌린다(원장은 append-only 라 역분개 행을 쌓고, 원본의 `attendanceId` 를 떼어 재체크 시 차감이 건너뛰어지지 않게 한다). 알림톡은 회수 불가라 토스트가 그 사실을 밝힌다.
  - **원생 안전정보를 자유 텍스트에서 꺼내 컬럼으로** (마이그레이션 `20260806020000`): `allergies[]`·`temperaments[]`·`marksIndoors`·`mountingBehavior`·`hasBiteHistory`·`vaccinations(JSONB)`·`adaptationStartedAt` + 픽업 `pickupTime`/`pickupMethod`/`shuttleNumber`. 전부 `careNote` 문장 안에 있어서 **카드 표면에 올릴 수도 필터를 걸 수도 없었다.**
    - `temperaments` 는 **형용사가 아니라 상황 서술**로 저장한다("소심함" ✗ / "대형견 무서워함" ○) — 훈련사가 합사 그룹을 나눌 때 그대로 써야 하고 형용사는 그게 안 된다.
    - 접종 **상태는 저장하지 않는다**(`resolveVaccination` 이 조회 시점 계산). 저장하면 날짜가 지나도 갱신되지 않아 "만료됐는데 정상으로 표시되는" 최악의 실패가 난다. 기록이 **아예 없으면 `caution`** 이다 — "확인했고 문제없다"와 "아무도 확인한 적 없다"가 같아 보이면 안 된다.
    - 기존 `careNote` 문장을 **자동 파싱해 옮기지 않았다** — 잘못 파싱한 알러지는 없는 것보다 위험하다. 원장이 `EditPetDialog` **맨 위** 섹션에서 확인하며 채운다.
  - **원생 목록: 표 → 카드** (`widgets/dog-roster`, `entities/pet/DogCard` 컴파운드). 8열 표는 모바일에서 가로 스크롤이 생겨 알러지도 접종 만료도 화면 밖에 있었다. **기본 정렬이 이름순이 아니라 픽업 시각 오름차순**(서버가 정한다) — 15~18시가 가장 혼잡해서 그 목록이 곧 오후 작업 순서표다. 접종 만료·공격 이력이면 **카드 테두리를 승격**(`border-2 border-danger`)한다. 배지는 멈춰서 봐야 읽히고 테두리는 지나가면서도 보인다. 접종 만료견의 등원 버튼은 **disable 하지 않고** 확인 시트를 띄운다 — 막으면 앱 밖에서 처리해 기록이 사라진다.
  - **매장 홈: 메뉴판 → 오늘** (`widgets/today-board`, `GET v1/admin/dashboard`). 우선순위 기준은 '중요도'가 아니라 **"지금 안 보면 되돌릴 수 없는 정도 × 오전에만 대응 가능한 정도"** — ① 등원 현황(미도착 이름) ② 오늘 주의할 아이 ③ 훈련사 배치 비율 ④ 픽업 타임라인 ⑤ 이용권 잔여. 한 응답으로 받는 이유: 블록마다 따로 부르면 우선순위가 **로딩 순서**로 바뀐다. 예방접종 만료를 별도 카드로 만들지 않은 이유는 결국 "그 아이가 오늘 오나"를 확인하러 등원 목록으로 다시 들어가야 하기 때문 — 동선 위에 얹는 게 카드를 늘리는 것보다 인지 부하가 작다.
  - **배지 색은 분류가 아니라 긴급도만** (`normal`/`caution`/`critical` 3단계 고정). 출석 6색·구독 4색·리포트 2색이 각각 다른 파일에서 따로 칠해져 **같은 "정상"이 화면마다 다른 초록**이었다. 판정은 `packages/shared/src/pet-safety.ts` 한 곳 — 화면과 서버가 각자 구현하면 칩에 "주의 5"라 써 놓고 눌렀을 때 3마리만 나온다.
  - 검증: `apps/web` **프로덕션 빌드 성공**(전 라우트), `tsc --noEmit` clean(양 앱), `eslint` 0 errors. 체크리스트 전수 grep — 팔레트 밖 색 0건, 15px 미만 0건, `size='sm'` 0건(web), HEX 리터럴 0건(`canvasColor` 브리지 제외), `entities → features` 역방향 import 0건. 마이그레이션은 스크래치 DB 재생 후 `migrate diff --exit-code` **No difference**.
  - ⚠️ **브라우저 상호작용은 검증하지 못했다** — 이 샌드박스에 headless Chromium 이 없다. SSR/빌드까지만 확인했고, 바텀시트 드래그·되돌리기 토스트·필터 칩 가로 스크롤은 **실기기 확인이 남아 있다.**
  - 스펙 대비 미구현: **대시보드 "미결제 건수"** — 이 스키마의 매출(`TenantSale`)은 돈을 받은 시점에만 생기고 외상/미수금 개념이 없다. 0으로 그리면 "미결제가 없다"고 읽히는데 그건 거짓이라 아예 내려주지 않는다(`TenantSale.status` 또는 별도 미수금 모델이 먼저다). **`scheduledArrivalAt`(도착 예정 시각)** 도 없어 대시보드 1순위의 "시간대별 도착 예정"은 픽업 시각으로 대체했다.
- **디자인 컨벤션 + 정보위계 재설계 (job-048, 2026-08-05)**: `docs/design-system.md` 신설. 29개 화면에 `rounded-xl/lg/2xl/full` 이 섞이고 `gap-1~6` 이 제각각이던 것을 **간격 5단계·라운딩 3단계**로 고정하고, 규칙을 코드로 굳힌 공용 컴포넌트를 `shared/ui` 에 뒀다(`SectionHeading`·`EmptyState`·`StatTile`). ⚠️ **가장 큰 변경은 색이 아니라 순서다**: 홈이 메뉴가 아니라 **오늘**이 되게 뒤집었다.
  - **보호자 홈 `/app`**: 바로가기 카드 4장 → ① 오늘의 알림장 ② 남은 횟수(0회면 경고색) ③ 바로가기. 보호자가 이 앱을 여는 이유는 "우리 애 오늘 어땠나"지 메뉴를 고르러 오는 게 아니다 — 단톡방을 이기려면 단톡방처럼 열자마자 오늘 소식이 보여야 한다. 아이가 없으면 빈 격자 대신 **등록 안내 하나**로 대체(신규 사용자가 처음 보는 화면).
  - **매장 홈**: 카드 7장 나열 → "오늘 사진 0장" 경고를 맨 위로, 관리 메뉴는 그 아래 섹션으로. 시간이 지나면 되돌릴 수 없는 항목이 그것 하나뿐이다.
  - **하단 탭 6 → 5** (엄지 도달 범위). "내 매장"은 홈 바로가기로 내렸다.
  - **전 화면 정돈 완료**: 라운딩 22개 파일에서 `lg`/`md` 제거 → `xl`/`full`/`2xl` 3종, 간격은 `1.5/2/3/4/6` 5종으로 수렴. ⚠️ `gap-2` 는 **컨벤션에서 빼려다 되살렸다** — 전수 조사에서 70곳이 쓰고 있었고, 이미 자리잡은 관용을 규칙이 부정하면 규칙이 안 지켜진다. 대신 한두 곳만 쓰던 `gap-1`·`gap-5`·`gap-7` 을 없앴다. 컨벤션의 목적은 선택지를 줄이는 것이지 기존 코드를 갈아엎는 게 아니다.
  - `EmptyState` 가 `action` 을 받는 이유: "등록된 아이가 없어요"만 띄우고 버튼이 없어 보호자가 아무것도 못 하던 화면이 실제로 있었다(job-040). 빈 상태는 신규 사용자가 처음 보는 화면이라 가장 공들여야 한다.
- **공개 알림장 링크 강화 (job-047, 2026-08-05)**: 토큰이 알림장 1건이 아니라 **아이**를 가리킨다 — 같은 링크에서 그 아이의 지난 알림장을 이어 볼 수 있어야 "우리 아이 기록이 쌓이는 곳"이 된다(예전엔 매일 새 링크를 받는 일회성 알림이었다). 응답에 ① 지난 알림장 ② `Tenant.contactPhone`(신설, 미가입 보호자가 문의할 유일한 경로) ③ **초대 토큰**을 함께 싣는다. 링크의 "카카오로 시작하기"가 토큰을 sessionStorage 에 넣고, 게이트(job-041)가 그걸 써서 **전화번호를 다시 묻지 않고** 아이를 연결한다 — 예전엔 링크가 이미 아는 정보를 버리고 사용자에게 번호를 되물어, 안 넣으면 연결이 끊겼다.
- **보호자 조회 + 역할 경계 정리 (job-046, 2026-08-05)**: `GET v1/attendances/mine` 신설 — 회수권을 파는데 보호자가 "이번 달 몇 번 갔지"를 볼 수 없었다(403). 소유 검사는 매장이 아니라 **아이 기준**이라 여러 매장에 맡겨도 한 번에 보인다. `/subscriptions` 화면에 아이별 잔액 + 등원 이력을 붙였다(`widgets/my-tickets`). **원생 등록을 STAFF 에게 열었다** — 처음 온 보호자를 맞는 건 데스크 업무인데 원장 전용이라 원장이 자리를 비우면 신규 원생을 못 받았다(경영 업무는 그대로 TENANT_ADMIN). **알림 발송 이력 화면** 신설(`/tenant/[tenant]/notifications`) — 알림톡이 이 제품의 전달 경로 전체인데 실패가 `NotificationLog.status=FAILED` 로만 남고 볼 화면이 없었다.
- **이용권을 아이 단위로 (job-045, 2026-08-05)**: `SubscriptionLedger.userId` → **`petId`** 로 잔액 체인을 옮겼다(마이그레이션 `20260805020000`, 백필 3경로: 출석 연결 → 아이 1마리 → 자리표시자). 두 가지가 동시에 깨져 있었다: ① 계정 없는 원생은 차감이 통째로 건너뛰어져 **회수권을 파는 매장이 도입 첫날 한 번도 차감하지 못했다**(job-040 이후 원생 전원이 그 상태다). ② 형제견이 한 지갑을 나눠 써 "초코 10회권"과 "두부 10회권"을 구분할 수 없었다. 함께 고친 것: **충전 경로가 아예 없어 잔액이 0에서 시작해 -1, -2 … 로 끝없이 내려가던 것**(`POST v1/subscriptions/ledgers/charge` 신설, 잔액 0이면 차감을 멈추고 사유를 남긴다), **`balanceAfter` 를 호출부가 넣던 것**(동시 요청이 서로 덮어써 회수권이 공짜가 되거나 두 번 차감된다 → 서버가 계산).

- **전화번호 표기 통일 (job-043, 2026-08-05)**: **저장은 언제나 숫자만, 화면은 언제나 하이픈.** 이 번호는 표시 데이터가 아니라 **매칭 키**다 — 매장이 `010-1234-5678` 로 등록해 둔 아이를 보호자가 `01012345678` 로 가입하며 찾는데(`claimForUser`), 표기가 섞이면 그 연결이 조용히 실패한다.
  - `normalizePhone`/`formatPhone`/`PHONE_MAX_DIGITS` 를 `packages/shared/src/phone.ts` 로 옮겼다. 전에는 `invitation.service.ts`(API 서비스 파일) 안에 있어 웹이 쓸 수 없었고, 그래서 입력값이 그대로 저장되는 경로가 남아 있었다. 기존 import 경로를 위해 그 파일에서 re-export 한다.
  - 프런트는 `shared/ui/PhoneInput` 하나로 통일 — 숫자 아닌 문자는 붙여넣기 포함해 아예 들어오지 않고, 표시만 하이픈으로 그린다(`value` 는 언제나 숫자열). 적용처 7곳: 프로필·최초 진입 게이트·원생 등록(intake)·내 아이 등록/수정·아이 정보 수정 요청·구성원 초대.
  - **서버가 마지막 방어선**이다 — `cleanPhone`(pet.service) 이 `guardianPhone`/`emergencyContactPhone`/픽업 담당자 번호를 저장 직전 정규화한다. API 를 직접 부르는 경로(스크립트·연동)에서 하이픈이 들어와도 갈리지 않는다. 빈 문자열은 `undefined` 로 바꿔 "값을 안 보냄"과 구분한다 — 그러지 않으면 수정 폼에서 칸을 비웠을 때 빈 문자열이 저장돼 `resolveGuardianPhone` 폴백이 걸리지 않는다.
- **로그인 착지점 라우팅 (job-042, 2026-08-05)**: 로그인 후 갈 곳이 `/app` 고정이 아니라 **소속에 따라 갈린다** — 운영 중인 매장이 1개면 `/tenant/<subdomain>` 직행, 2개 이상이면 고르기 화면(`views/launch`), 0개면 `/app`. 판단은 `(checkauth)/launch/page.tsx` 가 SSR 로 한다.
  - ⚠️ **"운영 중인 매장" 은 `STAFF`/`TENANT_ADMIN` 소속만이다.** GUARDIAN 을 포함하면 아이를 한 곳에 맡긴 보호자가 로그인하자마자 매장 운영 화면에 떨어지는데, 거기 메뉴는 전부 스태프용이라 `TenantHomePage` 가 "운영 권한이 없습니다" 카드만 띄우고 API 도 403 을 준다. `ACTIVE` 멤버십 + `tenant.isActive` 도 함께 본다(정지된 매장·승인 대기는 세지 않는다).
  - **판단을 API 가 아니라 web 에 둔 이유**: 매장 주소 규칙(`/tenant/<subdomain>/…`)은 web 의 것이라, 소셜 콜백이 그 주소를 조립하기 시작하면 경로가 바뀔 때마다 양쪽을 같이 고쳐야 한다. `successRedirect("web")` 는 `/launch` 만 가리킨다. 덤으로 `/launch` 가 `(checkauth)` 안에 있어 **약관 게이트(job-041)를 그대로 물려받는다** — 최초 로그인 사용자는 `/welcome` 으로 먼저 걸러지고, 동의를 마치면 `/launch` 로 돌아와 매장 라우팅을 받는다.
  - 소속 목록은 `(checkauth)` 레이아웃이 이미 부르는 `mypage` 응답에 있어 추가 요청이 없다. 착지점을 쓰는 다른 자리(`useLogin`, 랜딩의 "콘솔로 이동")도 전부 `/launch` 로 통일했다. `MobileNav` 의 "홈"은 개인 화면을 명시적으로 가리키는 링크이므로 `/app` 그대로 둔다.
- **최초 진입 게이트 — 약관 동의 + 전화번호 (job-041, 2026-08-05)**: 발견한 것부터: **카카오 로그인은 약관 동의를 아예 기록하지 않는다.** `social-auth.service.ts` 에 terms 관련 코드가 한 줄도 없어 `prisma.user.create` 가 `UserTermsAgreement` 를 만들지 않는다(이메일 가입 `auth.service.ts:63` 은 필수 약관을 강제하는데 소셜은 그 검사를 통째로 우회한다). `apps/web` 은 카카오 전용이므로 **web 사용자 전원이 필수 약관 미동의 상태**였다.
  - **게이트**: `mypage` 가 `pendingRequiredTerms`(미동의 활성 필수 약관)를 함께 내려주고, `(checkauth)/layout.tsx` 가 비어 있지 않으면 `/welcome` 으로 redirect. 레이아웃이 이미 매 요청 mypage 를 부르므로 추가 요청이 없고, 개별 페이지에 흩어두면 새 라우트마다 빠뜨린다. ⚠️ **`/welcome` 은 `(checkauth)` 바깥**에 있다 — 안에 두면 게이트가 자기 자신으로 무한 리다이렉트한다. 대신 그 페이지가 직접 `getMe` 로 인증을 확인하고, 이미 동의했으면 `/app` 으로 돌려보낸다.
  - **`POST v1/auth/complete-profile`**: 필수 약관을 **먼저** 검증하고, 통과한 경우에만 전화번호를 저장한 뒤 `claimForUser` 를 돌린다. 번호는 개인정보이고 수집 근거가 그 동의라, 이 순서가 뒤집히면 동의 없이 개인정보를 받은 것이 된다. 같은 약관 재제출 시 로우가 쌓이지 않도록 delete→create.
  - **전화번호는 선택**이다. 매장에 다니지 않는 개인 보호자에게는 필요 없고 첫 화면에서 막으면 이탈한다. 대신 화면이 **건너뛰면 무엇을 잃는지 명시한다** — "가입 전 유치원에서 등록해 둔 아이 정보와 알림장을 연결할 수 없다"(그 연결의 유일한 키가 번호). 나중에 프로필에서 넣으면 `updateProfile` 이 같은 claim 을 다시 돌린다는 것까지 적는다.
  - `TermsDetail` 계약에 `content` 가 빠져 있던 것도 함께 고쳤다 — DB 컬럼이 아니라 `TermsService` 가 파일에서 읽어 붙이는 값이라 `extends Terms` 로는 잡히지 않았다. 동의 화면은 이 본문을 다이얼로그(`entities/terms`)로 보여준다(web 에 약관 뷰어 라우트가 없어 링크로 걸면 404 이고, 페이지를 떠나면 체크가 날아간다).
  - ⚠️ **`TODO(job-042)`: 전화번호는 자기신고다.** 남의 번호를 입력하면 `claimForUser` → ACTIVE 멤버십 + 펫 소유권까지 그대로 넘어가 그 아이의 알림장·사진에 접근할 수 있다. 사용자 결정으로 **지금은 자기신고 그대로 두고 이후 Solapi SMS OTP 를 붙인다**(인증된 번호만 claim 에 넘기는 형태). 그전까지 이 경로가 신뢰 경계다. 참고로 CLAUDE.md §4 의 `SubmitOtpRequest` 계약은 문서에만 있고 `apps/api/src` 에 구현이 없다.
- **미가입 보호자 원생 등록 + 알림톡 (job-040, 2026-08-05)**: 이 서비스의 경쟁 상대는 멍플로우가 아니라 **카톡 단톡방**이고, 단톡방은 설치도 가입도 요구하지 않는다. 그런데 `Pet.userId` 가 NOT NULL 이면 "가입한 보호자의 아이만 원생이 될 수 있다"가 되어, 매장이 도입하는 첫날 원생 20마리의 보호자를 전원 가입시켜야 시작이 가능했다. `Pet.userId` / `NotificationLog.userId` 를 nullable 로 내려(마이그레이션 `20260805000000`) **계정 없이 원생을 만들고 그날부터 출석·사진·알림톡이 돈다** — 알림톡은 원래부터 계정이 아니라 전화번호(`Pet.guardianPhone`)로 나갔고, 막고 있던 것은 그 두 개의 FK 뿐이었다. 딸린 것들:
  - **등록 단일 진입점** `GET/POST v1/admin/pets/intake[/lookup]` (`AdminModule` 의 `PetIntakeService`). 원장이 아는 건 전화번호뿐이므로 화면을 회원용/비회원용으로 가르지 않고 **서버가 세 갈래로 분기**한다: 기존 아이 선택(`ENROLLED_EXISTING`) · 회원의 새 아이(`CREATED_FOR_MEMBER`) · 미가입(`CREATED_FOR_UNREGISTERED`, `userId=null` + 초대장). ⚠️ **아이 목록은 우리 매장 구성원일 때만 내려준다** — 아니면 번호를 넣어보는 것만으로 남의 아이 이름을 훑을 수 있다. 번호가 두 계정에 걸리면 임의로 고르지 않고 409 로 멈춘다(`User.phone` 은 유니크가 아니다).
  - **초대장이 이미 만든 원생을 가리킨다** (`TenantInvitation.petId`, 마이그레이션 `20260805010000`). 없으면 보호자가 가입하는 순간 `attachWithPet` 이 펫을 새로 만들어 **같은 아이가 두 마리로 갈라지고** 그때까지의 기록이 안 보이는 쪽에 남는다. 이 자리표시자는 30일이 아니라 사실상 만료되지 않는다(`PET_LINK_TTL_DAYS`) — 링크가 아니라 번호-아이 약속이기 때문.
  - **공개 알림장** `/r/<token>` (`ReportShareService`, HMAC 서명 + 2주 만료, `@Public()`). 알림톡 링크가 로그인을 요구하면 전제가 마지막 한 칸에서 무너진다. 응답에 보호자 연락처·계정·다른 아이는 담지 않고 PUBLISHED 만 연다. 링크 생성은 **호출부(CareModule)** 가 한다 — `NotificationService` 에서 부르면 Care↔Notification 순환 의존.
  - **보호자 본인 등록 UI** `features/pet/create-my-pet` → `POST v1/pets` (`/pet` 화면). 서버에는 있었는데 호출하는 화면이 없어 보호자는 매장이 대신 등록해 줄 때까지 아무것도 못 했다.
  - **연락처 폴백** `resolveGuardianPhone` (`shared/utils/guardian.ts`): `guardianPhone → user.phone`. 보호자가 직접 등록한 아이는 `guardianPhone` 이 선택 입력이라 비어 있기 쉬웠고, 폴백이 없어 **가입한 보호자인데도 알림이 조용히 누락**됐다.
  - ⚠️ **후속 회귀 수정 (job-044)**: `Pet.userId` 를 nullable 로 내렸는데 계약 타입 `PetWithOwner.user` 는 non-nullable 그대로여서, **계약이 거짓말을 하는 동안 TS 가 프런트를 잡아주지 못했다.** 그 결과 계정 미연결 원생이 하나라도 있는 매장에서 `pet.user.nickname` 이 TypeError 를 내며 **원생 목록·리포트 작성 화면이 통째로 렌더 실패**했다(SSR 은 200 이라 서버 로그에는 아무것도 안 남는다 — 이런 부류는 상태 코드로 안 잡힌다). 계약을 `| null` 로 고치자 TS 가 3개 파일 5곳을 즉시 짚었고(`PetsTable`·`DailyReportForm`·`EditPetDialog`), 화면은 빈칸 대신 **"계정 미연결 + 등록된 연락처"** 를 보여준다 — 그 아이들이 곧 가입 유도 대상이라 원장이 여기서 바로 알아야 한다. **교훈: Prisma 스키마의 nullable 변경은 `packages/shared` 계약까지 따라가야 한다. 계약이 진실이 아니면 타입 검사는 통과하면서 런타임만 깨진다.**
  - **버그 2건 수정**: `AdminService.createPet` 은 주석에 "아래에서 멤버십 확인"이라 쓰여 있는데 실제 검증이 없어 남의 매장 회원에게 원생을 붙일 수 있었다(→ 403). 계정 없는 아이는 이용권 원장(ledger)이 없으므로 `AttendanceService.deductIfLinked` 가 **차감을 건너뛰고 경고를 남긴다** — 이용권을 아이 단위로 재설계할지는 `TODO(job-041)`.
- **피드 기반 알림장 (job-034, 2026-08-04)**: `plan.md` 의 중심 가설 — "폼 20건" 대신 "사진 12장"으로 원생 20마리를 덮는다 — 을 구현. `FeedPost`(사진 여러 장) → `FeedMedia` → `FeedTag`(**사진 한 장에** 등장한 아이들) → **태그된 아이의 보호자에게 팬아웃**. ⚠️ 태그는 게시물이 아니라 **사진**에 붙는다(`FeedTag.mediaId` NOT NULL) — 게시물 단위로 두면 12장을 한 번에 올릴 때 12장 전부가 태그된 모든 아이에게 가서 §3 산술이 깨지고 초코만 나온 사진이 두부 보호자에게 간다. 동의 검사·하루 마감 집계·보호자 피드 필터가 전부 이 단위로 돈다. 기존 `DailyReport` 를 대체하지 않고, 저녁에 `FeedDigestService` 가 아이별로 그날 태그를 모아 리포트를 자동 생성한다("선생님은 알림장을 한 번도 쓰지 않는다"). 딸려 오는 것들: 태그 = 오늘 등원한 아이이므로 **출석부가 자동 생성**되고(단 정기권 차감은 하지 않는다 — 사진 업로드가 돈을 움직이면 안 된다), 사람이 AI 제안을 고친 내역은 `FeedTagCorrection` 에 학습 데이터로 쌓인다. 방어 장치 2개도 함께: `GET v1/feed/coverage` 의 "오늘 사진 0장" 집계(`widgets/photo-gap-alert`)와 `Pet.photoConsent` 3단계(PRIVATE 아이는 단체 사진에 태그 불가 — 태그 화면에서 잠기고 발행 시 400). 알림톡은 **아이 1마리당 하루 1건**으로 제한한다(게시물마다 보내면 원가가 그대로 곱해진다). 화면: 매장 `/tenant/[tenant]/feed`(+`/new` 업로드), 보호자 `/feed`.
- **Landing page console button (job-033, 2026-08-03)**: `views/landing/LandingPage.tsx` is now a client component that calls a new `useMe()` hook (`entities/user/model/useMe.ts`, exported via the `entities/user` barrel) which queries `GET /v1/auth/mypage`. Logged in → header shows a "콘솔로 이동" button (`useRouter().push("/app")`); logged out → the original "로그인" link. `useMe` passes `validateStatus: status => status === 200 || status === 401` so an anonymous 401 is treated as "no user" data instead of tripping the shared axios interceptor's refresh-then-hard-redirect flow (`shared/libs/axios/interceptors.ts`) — without that, an anonymous visitor to the public landing page would get bounced to `/auth/login`.
- **Kakao login → `/app` redirect (job-032)**: social login is a server-driven 302 flow (`apps/api/src/auth/services/social-auth.service.ts`); `successRedirect("web")` lands on `/app`. No `apps/web` client cache for session data — `(checkauth)` layout re-fetches `mypage` via SSR on every navigation.
- **App boundary split**: `apps/admin` is `SUPER_ADMIN`-only (tenants · platform members · platform subscriptions · terms · plans · system); every store-scoped screen lives in `apps/web` under `(checkauth)/(tenantAuth)/tenant/[tenant]/…`, gated by membership + ACTIVE status + `tenant.isActive`. The URL (not `localStorage`) is the source of truth for the active tenant.
- **Auth**: Kakao-only social login for `apps/web` (no signup screen — account created on first Kakao login); `apps/admin` keeps email/password for platform staff and e2e. `PATCH v1/auth/me` normalizes phone and re-runs invitation claiming.
- **Multi-tenancy**: `TenantMembership(userId, tenantId, role, status)` is the core model — a user can hold different roles in different tenants; store creation is gated on a 매장 개설권 subscription; invitations can target people with no account yet (phone/email, auto-resolved at signup).
