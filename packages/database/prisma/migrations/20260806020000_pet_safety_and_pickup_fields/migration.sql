-- job-052: 원생의 **안전 정보**와 **픽업 정보**를 자유 텍스트에서 꺼내 구조화한다.
--
-- 지금까지 알러지·성향·마킹·접종은 전부 `care_note` 한 칸에 사람이 쓴 문장으로 들어 있었다.
-- 그래서 두 가지를 할 수 없었다:
--
--  1. **카드 표면에 올릴 수 없다.** 원생 카드는 "조회용"과 "사고 예방용"을 갈라 사고 예방용만
--     표면에 올려야 하는데(design-system.md §6.1), 한 덩어리 문장에서 알러지만 뽑아낼 수 없다.
--     한 뎁스 아래로 숨기면 급할 때 놓치고, 이 부류는 놓치면 사후 확인이 무의미하다.
--  2. **필터를 걸 수 없다.** "마킹 잦은 아이만", "접종 만료된 아이만"은 합사 그룹을 짜거나
--     등원을 받을 때 실제로 필요한 질의인데, 문자열 LIKE 로는 표기가 조금만 달라져도 빠진다.
--
-- `care_note` 는 지우지 않는다 — 구조에 담기지 않는 서술(투약 방법, 보호자 당부)이 남는다.
-- 기존 문장을 자동 파싱해 옮기지 않는 이유: 잘못 파싱한 알러지는 **없는 것보다 위험하다**.
-- 원장이 아이를 열어 확인하며 채우는 것이 맞고, 그때까지는 빈 값이 정직한 상태다.

-- ── 안전 정보 ────────────────────────────────────────────────────────────────
ALTER TABLE "pets" ADD COLUMN "allergies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 성향은 형용사가 아니라 상황 서술로 넣는다("소심함" ✗ / "대형견 무서워함" ○).
-- 훈련사가 합사 그룹을 나눌 때 그대로 쓸 수 있어야 하고, 형용사는 그게 안 된다.
ALTER TABLE "pets" ADD COLUMN "temperaments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 시설 운영(배치·청소)에 직접 영향을 주는 항목은 자유 메모와 분리한다 — 곧 필터가 필요해진다.
ALTER TABLE "pets" ADD COLUMN "marks_indoors" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pets" ADD COLUMN "mounting_behavior" BOOLEAN NOT NULL DEFAULT false;

-- 공격/입질 이력만 별도 불리언인 이유: 이것 하나만 긴급도가 critical 이라 **카드 테두리를
-- 승격**시킨다. temperaments 안의 문자열로 두면 표기 차이로 조용히 누락된다.
ALTER TABLE "pets" ADD COLUMN "has_bite_history" BOOLEAN NOT NULL DEFAULT false;

-- [{ type: 'comprehensive'|'rabies'|'kennel_cough'|'corona', expiresAt: 'YYYY-MM-DD' }]
-- 만료/임박 판정은 저장하지 않는다 — 저장하면 날짜가 지나도 갱신되지 않아
-- "만료됐는데 정상으로 표시되는" 최악의 실패가 난다. 조회 시점에 계산한다.
ALTER TABLE "pets" ADD COLUMN "vaccinations" JSONB;

-- 적응 기간은 일수가 아니라 시작일을 갖는다. 일수를 저장하면 매일 배치로 올려야 한다.
ALTER TABLE "pets" ADD COLUMN "adaptation_started_at" DATE;

-- ── 픽업 ─────────────────────────────────────────────────────────────────────
-- 원생 목록의 기본 정렬 키다. 유치원은 등하원 시각이 제각각이고 15~18시가 가장 혼잡해서,
-- 픽업 시각 순 목록이 그대로 오후 작업 순서표가 된다(이름 검색은 검색창이 대체한다).
ALTER TABLE "pets" ADD COLUMN "pickup_time" TEXT;
ALTER TABLE "pets" ADD COLUMN "pickup_method" TEXT;
ALTER TABLE "pets" ADD COLUMN "shuttle_number" INTEGER;

-- 정렬 인덱스. 매장별 픽업 시각 순 조회가 이 화면의 기본 질의다.
-- Postgres 는 ASC 의 기본이 NULLS LAST 이므로, 픽업 시각을 아직 안 넣은 아이가 자연스럽게
-- 뒤로 간다 — 시각을 아는 아이가 먼저 처리 대상이라 그게 맞는 순서다.
CREATE INDEX "pets_tenant_id_pickup_time_idx" ON "pets" ("tenant_id", "pickup_time");
