/**
 * 파일 저장 도메인 — `resources/uploads/<tenant|_shared>/<domain>/<path>/` 의 첫 칸.
 *
 * 값이 곧 디스크 경로이므로 **이름을 바꾸면 이미 저장된 파일을 찾지 못한다.** 새 도메인을
 * 더할 수는 있어도 기존 값의 철자를 고치는 것은 마이그레이션이 필요한 변경이다.
 */
export const domains = [
  "terms",
  "daily-report",
  "feed",
  "pet",
  // job-063: 회원 프로필 사진 · 매장 대표 이미지. 둘 다 `FileOwnership.shared` 로 올라가
  // `_shared/` 아래에 저장된다(job-055) — 회원은 매장에 걸치지 않고, 매장 이미지는
  // 로그인 없이 열리는 공개 화면에 나가기 때문이다.
  "user",
  "tenant",
] as const;

export type Domain = (typeof domains)[number];
