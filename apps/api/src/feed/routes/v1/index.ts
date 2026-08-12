export const FEED_ROUTES = {
  BASE: "v1/feed",

  // ── 업로드 플로우 ───────────────────────────────────────────────────────
  SUGGEST_TAGS: "suggest-tags", // POST: 방금 올린 사진에 대한 아이 태그 제안 (후보는 오늘 등원한 아이로 한정)
  CAPTION_DRAFT: "caption-draft", // POST: 태그된 아이 기준 캡션 초안 제안

  // ── 보호자 ─────────────────────────────────────────────────────────────
  // ":id" 계열보다 먼저 매칭되어야 하므로 위쪽에 둔다.
  MY_LIST: "mine", // GET: 내 아이가 태그된 게시물만 (발행분, 여러 매장을 가로지름)

  // ── 원장/선생님 ────────────────────────────────────────────────────────
  COVERAGE: "coverage", // GET: 오늘 사진 0장인 아이 (?date=)
  DIGEST: "digest", // POST: 하루 마감 — 아이별 요약을 만들어 일일 리포트로 저장

  POST_LIST: "posts", // GET: 매장 피드 목록 (?date=, ?petId=)
  POST_CREATE: "posts", // POST: 게시물 작성 (사진 여러 장 + 태그)
  POST_GET: "posts/:id", // GET: 상세
  POST_UPDATE: "posts/:id", // PATCH: 캡션/태그 수정 (AI 제안과 달라진 부분은 학습 데이터로 기록)
  POST_DELETE: "posts/:id", // DELETE: 삭제
  POST_PUBLISH: "posts/:id/publish", // POST: 발행 — 태그된 아이의 보호자에게 팬아웃 + 알림톡
} as const;
