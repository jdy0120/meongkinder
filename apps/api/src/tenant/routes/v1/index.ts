export const TENANT_ROUTES = {
  BASE: "v1/tenants",
  ONBOARD: "onboard", // POST: 테넌트 가입/생성 + 초기 TENANT_ADMIN 계정 발급
  CHECK_SUBDOMAIN: "subdomain-availability", // GET ?subdomain=xxx: 서브도메인 사용 가능 여부
  // GET ?search= | ?swLat=&swLng=&neLat=&neLng= : 보호자가 가입 신청할 매장 찾기 (공개).
  // job-059: 이름 검색 + 지도 영역 검색을 한 경로가 받는다. 공개 응답이므로 담는 필드는
  // 서비스에서 명시적으로 고른다(상세주소는 제외).
  DIRECTORY: "directory",

  // ── 매장 설정 (job-059) — TENANT_ADMIN 이 **자기 매장**을 고친다 ────
  // 아래 SUPER_ADMIN 경로(":id")와 목적이 다르다. 대상은 활성 테넌트(X-Tenant-Id)이며
  // id 를 받지 않는다 — 남의 매장 id 를 넣어볼 자리를 만들지 않기 위해서다.
  // 고정 세그먼트이므로 ":id" 보다 **먼저** 선언되어야 한다.
  SETTINGS: "settings", // GET / PATCH

  // ── SUPER_ADMIN 전용 (플랫폼 운영) ────────────────────────────────
  // 주의: ":id" 는 고정 세그먼트(onboard·subdomain-availability)보다 뒤에서 매칭되어야 하므로
  // 컨트롤러에서도 반드시 고정 경로 핸들러를 먼저 선언한다.
  LIST: "", // GET:   테넌트 목록 (페이지네이션·검색)
  // GET: 서브도메인으로 테넌트 1건 조회 (job-050).
  // apps/web 의 매장 게이트가 쓴다 — SUPER_ADMIN 은 어떤 테넌트에도 소속되지 않으므로
  // 소속 목록에서 tenantId 를 얻을 수 없고, URL 에 있는 건 subdomain 뿐이다.
  GET_BY_SUBDOMAIN: "by-subdomain/:subdomain",
  GET: ":id", // GET:   테넌트 상세
  UPDATE: ":id", // PATCH: 테넌트 정보 수정 (이름·서브도메인)
  UPDATE_ACTIVE: ":id/active", // PATCH: 테넌트 활성/정지 토글
} as const;
