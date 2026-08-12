// Claude API 설정 — 알림장 요약/캡션 생성에 사용합니다.
// API 키는 서버에만 보관합니다. 발급: https://platform.claude.com

/**
 * 사용할 모델. 이 값이 원가를 좌우하므로 env 로 뺀다.
 *
 * 원생 30마리 · 주 3회 · 월 22일 기준, 매장 1곳의 하루 마감 요약 비용(월):
 *   claude-opus-5    약 7,100원   ($5 / $25 per MTok)
 *   claude-sonnet-5  약 4,300원   ($3 / $15)
 *   claude-haiku-4-5 약 1,400원   ($1 / $5)
 *
 * 이 글은 보호자에게 그대로 나가는 알림장이라 품질이 곧 제품이다. 기본값을 높은 쪽에
 * 두고, 실제 출력을 본 뒤 내리는 순서를 권한다 — 반대 순서는 품질 저하를 눈치채기 어렵다.
 */
const DEFAULT_MODEL = "claude-opus-5";

const apiKey = process.env.ANTHROPIC_API_KEY;

export const anthropicConfig = {
  apiKey,
  model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
  // 키가 없으면 LLM 호출을 아예 시도하지 않는다. 호출부는 규칙 기반 문장으로 폴백한다.
  isConfigured: Boolean(apiKey),
  /**
   * 한 번에 띄울 동시 요청 수. 하루 마감은 원생 수만큼 호출이 발생하므로(30마리 = 30콜)
   * 한꺼번에 쏘면 rate limit 에 걸린다. SDK 가 429 를 자동 재시도하지만 애초에 덜 만드는 편이 낫다.
   */
  concurrency: Number(process.env.ANTHROPIC_CONCURRENCY ?? 4),
} as const;
