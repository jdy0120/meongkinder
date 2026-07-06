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
- Response: Wrapped in `BaseResponse` by `TransformInterceptor` automatically.
- Error Typing: React Query's default error type is augmented globally via `global.d.ts` as `AxiosError<BaseResponse<unknown>>`. Rely on automatic type inference in callbacks (like `onError`) instead of specifying `any` or explicit typing.
