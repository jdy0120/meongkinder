# 프로젝트 작업 규칙 (Claude 우선 지침)

이 파일은 매 세션 자동 로드됩니다. 코드를 작성/수정하기 전에 아래 규칙을 우선 적용하세요.

## 1. 재사용 우선 (Reuse-first)

새 타입·유틸·헬퍼를 만들기 **전에** 반드시 공용 패키지에 이미 있는지 먼저 확인하고, 있으면 그것을 사용합니다. 직접 새로 짜지 마세요.

- 확인 순서: `packages/shared` → `packages/ui` → `packages/database`
- `packages/shared`(`@template/shared`): 프레임워크 비의존 공통 **타입 + 런타임 유틸**. api·web 공용.
- `packages/ui`(`@template/ui`): 공용 UI 컴포넌트. UI는 여기서 가져다 쓰고 앱 내부에 중복 구현하지 않습니다.
- `packages/database`(`@template/database`): Prisma Client/타입.
- 공용에 없어서 새로 만들어야 한다면, 앱 로컬이 아니라 **가능한 한 `packages/shared`에 추가**해서 api·web이 함께 쓰도록 합니다 (프레임워크 종속 코드만 앱에 둡니다).

## 2. API request/response 타입은 shared 계약으로 정의

api·web·미래의 다른 앱이 같은 요청/응답 형태를 공유하도록, **request/response 타입은 `packages/shared/types/contracts/<도메인>.ts`에 프레임워크 비의존 TS 타입으로 정의**합니다.

- 새 엔드포인트를 만들 때 request/response 타입을 먼저 `contracts`에 추가합니다.
- **api**: NestJS DTO 는 해당 request 계약을 `implements` 합니다. → 계약과 어긋나면 컴파일 에러(drift 방지).
  ```ts
  import type { CreateOrderRequest } from "@template/shared";
  export class CreateOrderDto implements CreateOrderRequest { /* class-validator 데코레이터 */ }
  ```
- **web / 다른 앱**: 같은 타입을 import 해서 요청 payload 와 응답(`BaseResponse<응답타입>`)을 타이핑합니다.
- 응답 타입은 서버가 내려주는 **data 페이로드**(즉 `BaseResponse<T>` 의 `T`)를 의미합니다. 토큰처럼 쿠키로 내려가는 값은 응답 타입에 넣지 않습니다.
- 참고 구현: `contracts/auth.ts`, `contracts/payment.ts` + 각 DTO 의 `implements`.

## 3. 목록 API는 공통 페이지네이션 유틸을 반드시 사용

페이지네이션·정렬·검색 로직을 **직접 손으로 구현하지 마세요.** 아래 공용 자산을 사용합니다.

### 서버 (api, NestJS)
- 쿼리 DTO: `PaginationQueryDto` (`apps/api/src/shared/dtos`)
- 서비스: `@template/shared`의 `resolvePagination()`로 skip/take·정렬 보정 → 조회 후 `buildPaginatedData(items, { page, pageSize, total })` 반환
- 응답은 `{ items, meta }` 형태 → 인터셉터가 `BaseResponse<PaginatedData<T>>`로 감쌈

```ts
const { page, pageSize, skip, take, order } = resolvePagination(query);
const [items, total] = await prisma.$transaction([
  prisma.x.findMany({ where, skip, take, orderBy: { createdAt: order } }),
  prisma.x.count({ where }),
]);
return buildPaginatedData(items, { page, pageSize, total });
```

### 클라이언트 (web, Next.js)
- **목록 요청은 `GetList`를 먼저 사용** (`apps/web/src/shared/libs/axios/request.ts`) — 일반 `Get`로 목록을 새로 짜지 않습니다.
- **화면 상태는 아래 훅을 먼저 사용** (`apps/web/src/shared/libs/query`):
  - 페이지 버튼형: `usePaginatedList<T>(key, url, query)`
  - 무한스크롤/더보기: `useInfiniteList<T>(key, url, query)`
- `useState`/`useEffect`로 목록 로딩·페이지 상태를 직접 관리하지 마세요.

```tsx
const { data, isLoading } = usePaginatedList<Order>("orders", "/payments/orders", { page });
// data?.items, data?.meta.totalPages, data?.meta.hasNext ...
```

## 4. `@template/shared`에 들어있는 것 (재사용 대상)

- 응답 봉투 타입: `BaseResponse`, `BasicResponse`, `ErrorResponse`, `HttpError`
- API 계약(request/response): `types/contracts/*` — 예) `LoginRequest`, `SubmitOtpRequest`, `RefreshRequest`, `LoginResponse`, `SubmitOtpResponse`, `CreateOrderRequest`, `ConfirmPaymentRequest`, `CancelPaymentRequest`, `CreateOrderResponse`, `PaymentResultResponse`
- 페이지네이션 타입: `PaginationQuery`, `NormalizedPagination`, `PaginationMeta`, `PaginatedData<T>`, `PaginatedResponse<T>`, `SortOrder`
- 페이지네이션 런타임 유틸: `PAGINATION_DEFAULTS`, `normalizePagination`, `toSkipTake`, `buildPaginationMeta`, `buildPaginatedData`, `resolvePagination`, `toQueryParams`
- 엔티티 베이스 타입: `BaseEntity`, `AsCreateRequest`, `AsUpdateRequest` 등

새 공통 자산을 추가하면 이 목록도 함께 갱신하세요.

## 5. 기타 컨벤션

- 모듈 구조는 기존 `auth`/`payment` 모듈을 따릅니다: `routes/` · `dtos/` · `controllers/` · `services/`, 모듈 파일에서 서비스 export.
- 인증 토큰/OTP는 DB가 아닌 **Redis**(`apps/api/src/shared/redis`)에서 관리합니다.
- 응답은 컨트롤러가 평범한 객체를 반환하면 `TransformInterceptor`가 `BaseResponse`로 감쌉니다.
