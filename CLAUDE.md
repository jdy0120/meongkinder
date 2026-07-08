# Project Rules (Agent Guidelines)

## 1. Reuse First

- Check: `@template/shared` (types/utils) -> `@template/ui` (shadcn components) -> `@template/database` (prisma client/types).
- Do not build local components/helpers if they exist in packages.
- Always use `@template/ui` components (`Button`, `Input`, `Label`, `Card`, `Field`, etc.) instead of raw HTML tags. Add generic logic to `@template/shared`.

## 2. API Contracts

- Define request/response types in `packages/shared/types/contracts/<domain>.ts`.
- **API**: NestJS DTO must `implements` the request type:
  ```ts
  import type { CreateOrderRequest } from "@template/shared";
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

## 4. `@template/shared` Contents

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
- Error Typing: React Query's default error type is augmented globally via `global.d.ts` as `AxiosError<BaseResponse<unknown>>`. Rely on automatic type inference in callbacks (like `onError`) instead of specifying `any` or explicit typing.

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
