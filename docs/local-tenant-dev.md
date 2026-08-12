# 로컬 테넌트 서브도메인 개발 환경 (`lvh.me` / `*.localhost`)

멀티테넌트 서브도메인(`acme.pawlog-dev.doyeonism.com` 형태) 동작을 실제 도메인/DNS 설정 없이
로컬에서 재현하기 위한 가이드입니다. `docs/multi-tenant-migration-plan.md` Phase 5-5 항목.

## 왜 hosts 파일 편집이 필요 없는가

- **`lvh.me`**: `lvh.me` 및 모든 서브도메인(`*.lvh.me`)이 항상 `127.0.0.1`로 해석되도록 미리 등록된
  공개 DNS 도메인입니다. 인터넷 연결만 있으면 별도 설정 없이 바로 사용할 수 있습니다.
- **`*.localhost`**: [RFC 6761](https://www.rfc-editor.org/rfc/rfc6761)에 따라 `localhost`와 그
  서브도메인은 대부분의 최신 브라우저/OS 리졸버가 자동으로 loopback(`127.0.0.1`)으로 처리합니다.
  단, 일부 환경(오래된 브라우저, 리눅스 배포판의 `nss` 설정)에서는 서브도메인 처리가 다를 수 있으니
  동작이 이상하면 `lvh.me`로 대체하세요.

## 로컬 접속 방법 (컨테이너 포트 직접 접근)

`make dev`로 기동한 컨테이너는 `SERVER_PORT`(3000) / `WEB_PORT`(3001) / `ADMIN_PORT`(3333)를
호스트에 직접 노출합니다(내부 `nginx`/엣지 프록시 경유 없이). 테넌트 서브도메인은 `Host` 헤더로
식별되므로(`apps/api/src/shared/middleware/tenant.middleware.ts`), 아래처럼 서브도메인을 붙인
호스트명 + 기존 포트로 접속하면 됩니다.

```
http://acme.lvh.me:3001        # web (테넌트 acme)
http://acme.lvh.me:3333        # admin (테넌트 acme)
http://acme.lvh.me:3000/api/pawlog-dev/v1/health
```

`acme`는 실제로 존재하는 테넌트의 `subdomain` 값이어야 합니다(§테넌트 준비 참고). 존재하지 않는
서브도메인이면 `TenantMiddleware`가 `Tenant`를 찾지 못해 식별 실패로 폴백하고, 이후 인증 단계에서
막힙니다.

## 사전 설정 (이미 기본값에 반영됨)

1. **`ALLOWED_ORIGINS`** (`envs/.env.dev`, `apps/api/src/shared/configs/app.setup.ts`) — 콤마로
   구분된 각 항목에 `*` 와일드카드를 한 번 넣을 수 있습니다. 기본값에 아래 패턴이 이미 포함되어
   있습니다:
   ```
   http://*.lvh.me:3001,http://*.lvh.me:3333,http://*.localhost:3001,http://*.localhost:3333
   ```
   새 포트/도메인을 추가하려면 이 콤마 목록에 패턴을 덧붙이세요. `*` 없는 항목은 기존과 동일하게
   완전 일치만 허용됩니다.
2. **Next dev 서버 cross-origin 허용** (`apps/web/next.config.ts`, `apps/admin/next.config.ts`) —
   Next.js는 dev 서버 자체 요청(HMR/RSC 등)에 대해 origin을 검사합니다. `allowedDevOrigins`에
   `*.lvh.me` / `*.localhost` / `*.pawlog-dev.doyeonism.com`이 등록되어 있어 추가 설정 없이 바로
   동작합니다. 프로덕션 빌드(`output: standalone`)에는 영향 없습니다.
3. **`docker-compose.dev.yaml`** — dev nginx의 `SERVER_NAME`이
   `${PROJECT_NAME}.doyeonism.com *.${PROJECT_NAME}.doyeonism.com`로 와일드카드 병기되어 있어,
   (엣지 프록시까지 wildcard로 연동되면) `https://acme.pawlog-dev.doyeonism.com` 형태의 진짜 도메인
   서브도메인 요청도 nginx 단에서 444로 막히지 않고 통과합니다. **단, 이 저장소가 관리하지 않는
   두 가지가 별도로 필요합니다**: (a) `*.pawlog-dev.doyeonism.com` 와일드카드 DNS, (b) 엣지
   Caddy(`ci/edge/`)에 와일드카드 인증서 블록 추가(DNS-01 challenge 필요, 현재
   `ci/edge/conf/Caddyfile`은 예시 도메인만 등록된 상태). 로컬 개발은 이 경로 없이 위 "컨테이너
   포트 직접 접근" 방식으로 충분합니다.

## 테넌트 준비 (subdomain 값 만들기)

- **온보딩 화면으로 생성** (job-030 신규): `apps/admin` `(home)/auth/onboarding` —
  테넌트 이름/서브도메인/초기 `TENANT_ADMIN` 계정을 한 번에 발급합니다
  (`POST /v1/tenants/onboard`, `GET /v1/tenants/subdomain-availability`).
- **seed 데이터**: `packages/database/seed.ts`의 `default-tenant`(subdomain: `default`)는
  `http://default.lvh.me:3001`로 접근 가능합니다.

## 쿠키/세션 관련 참고 (선택)

기본 `COOKIE_DOMAIN=.pawlog-dev.doyeonism.com`은 로컬 `lvh.me` 접근과 무관하게 동작합니다
(브라우저가 요청 Host 기준으로 쿠키를 저장하므로, 로그인한 서브도메인 자신에게는 정상적으로
쿠키가 심어집니다). 여러 `*.lvh.me` 서브도메인 사이에서 세션을 공유하고 싶다면(예: 서브도메인
전환 없이 `web`/`admin`이 쿠키를 공유해야 하는 시나리오), 로컬 전용으로 `envs/.env.dev`의
`COOKIE_DOMAIN`을 `.lvh.me`로 바꿔서 테스트할 수 있습니다 — 다만 이 값은 배포 도메인과 결합되어
있으므로 **커밋하지 말고 로컬에서만** 바꾸세요.

## 알려진 제약

- `apps/web`의 서브도메인 기반 라우팅(`middleware.ts` rewrite, `docs/multi-tenant-migration-plan.md`
  Phase 5-1)은 아직 구현되지 않았습니다. 위 방법으로 서로 다른 서브도메인에 접속해도 **백엔드
  tenantId 스코프(RLS/쿼리 격리)는 정상 동작**하지만, 프론트엔드 화면/라우트 자체가 서브도메인별로
  달라지지는 않습니다.
- `apps/admin`은 설계상 서브도메인이 아니라 **단일 도메인 + role 라우팅**을 사용합니다
  (Phase 5-2). 위 `acme.lvh.me:3333` 접근은 "그 테넌트로 로그인했을 때 tenantId가 올바르게
  스코프되는지" 확인하는 용도이며, admin 앱이 서브도메인마다 다른 화면을 보여주진 않습니다.
