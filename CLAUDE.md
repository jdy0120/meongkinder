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

## 5. RBAC

- Roles: `ROLES.USER` | `ROLES.ADMIN`. Store in DB `User.role` (default `USER`), pass in JWT payload (`req.user.role`).
- Guards: `JwtAccessGuard` (auth) -> `RolesGuard` (roles). `@Public()` bypasses both.
- Restrict admin endpoints using `@Roles(ROLES.ADMIN)`.

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
  // features/user/change-role/model/useUpdateUserRole.ts
  export const useUpdateUserRole = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, role }: { id: string; role: string }) =>
        Patch(`/v1/admin/users/${id}/role`, { role }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    });
  };
  ```
- **Forms** use `react-hook-form` (`useForm`) for input state and delegate submit to the feature's mutation hook. Do not hand-roll `useState` for field/error/loading.
- **Lists** use `usePaginatedList` in a widget (see §3); render rows/badges from `entities`.

## 8. Next.js Routing Conventions (web & admin)

Both `apps/web` and `apps/admin` follow the same route group structure.

```
src/app/
├── (home)/                   # Shared layout (ReactQueryProvider, Toaster, etc.)
│   ├── layout.tsx            # Common provider wrapper — no auth check
│   ├── (checkauth)/          # ✅ Auth-required area
│   │   ├── layout.tsx        # SSR: calls /v1/auth/mypage → redirects to /auth/login if unauthenticated
│   │   └── <feature>/        # All pages that require login go here
│   └── auth/                 # 🔓 Public area (login, forgot-password, reset-password, etc.)
│       └── <page>/
```

### Rules

| Situation                                            | Placement                                                 |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Pages accessible only to authenticated users         | `(home)/(checkauth)/<feature>/page.tsx`                   |
| Pages accessible without login (auth & public pages) | `(home)/auth/<page>/page.tsx` or `(home)/<page>/page.tsx` |

### Guidelines

1. **Auth-required routes**: Create a feature directory under `apps/web/src/app/(home)/(checkauth)/` or `apps/admin/src/app/(home)/(checkauth)/`.
   - `(checkauth)/layout.tsx` validates the session cookie via SSR and redirects to `/auth/login` if unauthenticated.
   - Do **not** add client-side guard code to `page.tsx` — the layout handles protection.

2. **Public routes**: Place pages under `apps/web/src/app/(home)/auth/` (or a sibling directory of `(checkauth)`).
   - These pages are outside the `(checkauth)` group and therefore bypass the session-validation layout.

3. **Keep pages thin**: `page.tsx` should only call a view component in a single line (see FSD §7).

   ```tsx
   // (checkauth)/dashboard/page.tsx
   import { DashboardPage } from "@/views/dashboard";
   export default function Page() {
     return <DashboardPage />;
   }
   ```

4. **Do not modify `(checkauth)/layout.tsx`**: The auth logic (`getMe` → redirect) in this layout must not be changed. If an auth condition needs to change, always confirm with the user before editing.

---

## 9. Pre-implemented Modules — Reuse Before Building

The following modules are **already fully implemented** in `apps/api`. Before writing any new service, controller, or endpoint, check whether the job is covered by one of these modules and **reuse it** instead of re-implementing the logic.

> Swagger reference: `http://localhost:3000/api/template-dev/docs`

| Module           | Source path                  | Base route         | Endpoints / Responsibility                                                                                        |
| ---------------- | ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **health**       | `apps/api/src/health/`       | `GET v1/health`    | DB + Redis liveness check                                                                                         |
| **auth**         | `apps/api/src/auth/`         | `v1/auth`          | Signup · Login · Logout · Token refresh · Mypage · Forgot/Reset password · Social OAuth (Kakao / Naver / Discord) |
| **terms**        | `apps/api/src/terms/`        | `v1/terms`         | Terms list & user agreement submission (`v1/terms/agreements`)                                                    |
| **payment**      | `apps/api/src/payment/`      | `v1/payments`      | Order creation · Payment confirmation · Cancel/Refund · Toss webhook · Order lookup                               |
| **subscription** | `apps/api/src/subscription/` | `v1/subscriptions` | Subscription plans · Billing-key registration · Subscribe · Cancel · My subscription                              |
| **file**         | `apps/api/src/shared/file/`  | `v1/file`          | Single-file upload to Azure Blob (`POST v1/file/upload`)                                                          |


## 10. Prisma Schema Changes — Never `db push`, Always a Committed Migration

Every change to `packages/database/prisma/schema/*.prisma` (new column, rename, drop, etc.) **must generate a migration file and commit it**. Breaking this rule produces a bug class that's very hard to catch: >

- **Why it doesn't break in dev**: `prisma db push` (or an equivalent auto-sync) immediately ALTERs the connected database to match `schema.prisma`. With no migration file needed, the dev DB is already up to d>
- **Why it breaks in production**: the container's boot script runs `prisma migrate deploy`, which never looks at `schema.prisma` at all — it only replays the SQL files already committed under `packages/databa>


### Rules

1. **Check first**: Before scaffolding a new module, verify whether the task relates to auth, payments, subscriptions, terms, file upload, or health. If it does, extend the existing module rather than creating a new one.
2. **Extend, don't duplicate**: Add new endpoints inside the existing module's `controllers/` and `services/` following the same `routes/v1/` → `controllers/` → `services/` layout (see §6 Conventions).
3. **Route constants**: Always define new paths in the module's `routes/v1/index.ts` route-constant file; never hardcode path strings in controllers.
4. **Admin variants**: Admin-only endpoints for the above domains live in `apps/api/src/admin/`. Check there as well before adding admin logic.

---

## Project Status

- Branch: `main`. Completed: job-001~003 (landing/`app` pages, post-login redirect), job-004 (Pet/DailyReport/ReportContent/Attendance/SubscriptionLedger schema + shared types + basic CRUD services).
- Next: pet-owner-facing read views for daily reports/attendance (owner-scoped, currently ADMIN-only), and real attendance check-in → SubscriptionLedger deduction business logic.

## Summary of current implementation status

- `apps/api`: auth, terms, payment, subscription (+ subscription-ledger), file-upload, health, pet, care (attendance/daily-report/report-content) modules implemented under `v1/` routing (see §9, §10).
- `packages/database`: schema adds `Pet`, `Attendance`, `DailyReport`, `ReportContent`, `SubscriptionLedger` (see `pet.prisma`, `care.prisma`, `subscription.prisma`); migration `20260727003146_add_pet_care_subscription_ledger` committed.
- `packages/shared`: model types under `types/models/{pet,care,subscription-ledger}` and request/response contracts under `types/contracts/{pet,care,subscription-ledger}.ts`.
- `apps/web`: public auth flow under `(home)/auth/`; public landing page at `(home)/page.tsx`; authenticated `/app` route at `(home)/(checkauth)/app/page.tsx` (placeholder content); login redirects to `/app`.
- `apps/admin`: authenticated dashboard + users/terms/subscriptions/system management under `(checkauth)/`.
