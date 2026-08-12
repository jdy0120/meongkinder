/**
 * 매장 개설권(SaaS seat) 발급 정책 (job-056).
 *
 * ## 왜 별도 토글인가
 *
 * 결제 연동(토스)을 붙이기 전에도 개설 흐름 전체를 돌려봐야 한다. 그런데 "결제를 못 하니
 * 그냥 공짜로 준다"를 **자동으로** 판단하게 두면 안 된다 — `TOSS_SECRET_KEY` 가 운영에서
 * 실수로 비는 순간 그 규칙이 "누구나 매장을 무료로 연다"로 바뀌고, 아무 에러도 나지 않아
 * 청구 누락을 한참 뒤에야 알게 된다. 돈이 걸린 분기는 추론하면 안 되고 **명시적으로 켜야**
 * 한다.
 *
 * 그래서 조건은 `tossConfig.isConfigured` 가 아니라 이 환경변수 하나다. 켜져 있지 않으면
 * 예전과 똑같이 카드 등록 + 결제를 요구한다.
 *
 * 켜면 발급된 개설권은 `billingKeyId = null` 로 남는다 — 결제로 발급된 건과 DB 에서
 * 구분되므로, 나중에 정산할 때
 * `SELECT * FROM user_subscriptions WHERE billing_key_id IS NULL AND status = 'ACTIVE'`
 * 로 전수 조회할 수 있다. 그 구분을 남기려고 별도 컬럼을 추가하지 않았다.
 */
export const seatConfig = {
  /** true 일 때만 결제 없이 개설권을 발급한다. 미설정/오타는 전부 false. */
  allowUnpaid: process.env.ALLOW_UNPAID_TENANT_SEAT === "true",
};
