export const ADMIN_ROUTES = {
  BASE: "v1/admin",
  ME: "me", // GET:   관리자 본인 정보
  // ⚠️ `users` 계열(목록·정보 수정·역할 변경)은 제거했다. 매장이 회원 계정을 다루면 안 된다:
  //   · 역할 변경 — `v1/memberships/:id/role` 과 완전 중복이었다. 이름만 user 였을 뿐
  //     실제로 바꾸던 것도 `TenantMembership.role` 이다.
  //   · 정보 수정 — `User.status` 를 쓸 수 있었는데 이건 **계정 전체** 상태다. A매장
  //     원장이 SUSPENDED 로 바꾸면 그 보호자는 B매장에서도 로그인이 막힌다. 계정 정지는
  //     플랫폼 소관이고 전용 경로가 따로 있다(`v1/platform/users/:id/status`).
  //   · 목록 — 응답에 약관 동의 이력이 실려 있었다. 그 약관은 매장 약관이 아니라 그 사람이
  //     pawlog 와 맺은 계약이라 매장이 열람할 근거가 없다.
  // 매장이 구성원을 다루는 경로는 `v1/memberships` 하나다.
  LIST_SUBSCRIPTIONS: "subscriptions", // GET: 구독 목록
  LIST_TERMS: "terms", // GET: 모든 약관 버전 목록
  GET_TERMS: "terms/:id", // GET: 약관 상세
  CREATE_TERMS: "terms", // POST: 약관 등록
  UPDATE_TERMS_ACTIVE: "terms/:id/active", // PATCH: 약관 활성화 토글
  // job-052: 매장 대시보드 (design-system.md §6.2).
  // 우선순위가 '중요도'가 아니라 "지금 안 보면 되돌릴 수 없는 정도 × 오전에만 대응
  // 가능한 정도"라, 한 응답에 다섯 블록을 함께 담아 순서를 서버가 보장한다.
  DASHBOARD: "dashboard", // GET: 오늘 등원현황·주의할 아이·배치비율·픽업타임라인·이용권

  LIST_PETS: "pets", // GET: 반려동물(원생) 목록 (전체 사용자 대상)
  // job-052: 원생 목록 필터 칩의 개수 (design-system.md §6.1).
  // ⚠️ 고정 경로라 컨트롤러에서 "pets/:id" 보다 **먼저** 선언되어야 한다.
  PET_SUMMARY: "pets/summary", // GET: 오늘 기준 등원/예정/하원/주의 두수
  GET_PET: "pets/:id", // GET: 반려동물 상세
  CREATE_PET: "pets", // POST: 반려동물 등록 (보호자 지정)
  UPDATE_PET: "pets/:id", // PATCH: 반려동물 정보 수정

  // job-053: 등원 스케줄. 펫 수정과 분리한 이유는 날짜 지정(MONTHLY)의 편집 단위가
  // **한 달**이라서다 — 펫 페이로드에 날짜를 실으면 8월을 고치는 요청이 9월까지 지운다.
  // ":id" 뒤에 고정 세그먼트가 붙으므로 "pets/:id" 와 충돌하지 않는다.
  GET_PET_SCHEDULE: "pets/:id/schedule", // GET:  ?month=YYYY-MM 그 달의 등원 예정일
  UPDATE_PET_SCHEDULE: "pets/:id/schedule", // PUT: 방식 전환 + 그 달 등원일 교체

  // job-040: 원생 등록 단일 진입점. 전화번호 하나로 회원/미가입을 서버가 갈라준다.
  // 고정 경로이므로 컨트롤러에서 "pets/:id" 보다 **먼저** 선언되어야 한다
  // (아니면 "pets/intake" 가 id="intake" 로 잡힌다).
  LOOKUP_PET_INTAKE: "pets/intake/lookup", // GET:  전화번호로 보호자·아이 후보 조회
  PET_INTAKE: "pets/intake", // POST: 원생 등록 (기존 선택 | 신규 | 미가입)
} as const;
