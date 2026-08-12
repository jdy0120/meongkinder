/**
 * 캔버스용 토큰 브리지 (design-system.md §2.5).
 *
 * ## 왜 필요한가
 *
 * 색은 `packages/ui/src/styles/tokens.css` 한 곳에만 있고, 컴포넌트는 토큰 **이름**으로만
 * 참조한다. 그런데 `<canvas>` 는 CSS 를 모른다 — `ctx.fillStyle` 에 `var(--primary)` 를
 * 넣으면 그냥 무시된다. 그래서 캔버스를 그리는 코드만 팔레트를 따로 들고 있게 되고,
 * 실제로 스토리 카드가 이전 팔레트(주황·앰버) 그대로 남아 **앱과 다른 색으로 공유되는**
 * 상태였다. 보호자가 SNS 에 올리는 이미지라 브랜드가 갈리는 곳이 하필 거기다.
 *
 * 여기서 `getComputedStyle` 로 **같은 토큰을 런타임에 읽어** 캔버스에 넘긴다.
 * 토큰을 고치면 캔버스도 함께 따라온다.
 *
 * ## 폴백에 HEX 가 있는 이유
 *
 * SSR·테스트처럼 `document` 가 없거나 스타일이 아직 안 붙은 순간에도 그림은 나와야 한다.
 * ⚠️ **이 파일이 tokens.css 외에 HEX 를 두는 유일한 자리다.** 토큰 값을 바꾸면 여기
 * 폴백도 같이 고칠 것 — 안 고치면 스타일 로드 전 첫 프레임만 옛 색으로 그려진다.
 */

/** 캔버스에서 쓰는 토큰 이름 → tokens.css 의 CSS 변수 + 폴백 값. */
const CANVAS_TOKENS = {
  primary: ["--primary", "#1e5f55"],
  primaryOnTint: ["--primary-on-tint", "#134a42"],
  primaryTint: ["--primary-tint", "#e9f2ee"],
  cautionFill: ["--caution-fill", "#e8843c"],
  cautionText: ["--caution-text", "#9c4e12"],
  cautionTint: ["--caution-tint", "#fcf0e4"],
  bg: ["--bg", "#faf8f4"],
  surface: ["--surface", "#ffffff"],
  text: ["--text", "#24211e"],
  textMuted: ["--text-muted", "#6e6660"],
} as const satisfies Record<string, readonly [string, string]>;

export type CanvasToken = keyof typeof CANVAS_TOKENS;

/**
 * 토큰 하나를 캔버스에 넣을 수 있는 색 문자열로 읽는다.
 *
 * 매번 `getComputedStyle` 을 부르는 것이 아깝다고 캐시하지 않는다 — 스토리 카드는
 * 사용자가 버튼을 누를 때 한 번 그리고, 캐시하면 테마가 바뀌었을 때 옛 색이 남는다.
 */
export const canvasColor = (token: CanvasToken): string => {
  const [variable, fallback] = CANVAS_TOKENS[token];

  if (typeof window === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();

  return value || fallback;
};
