-- job-060: 임시 휴무일 — 매장이 특정 날짜 하루를 쉰다.
--
-- tenants.business_hours 의 요일 시간표가 "평소"라면 이 테이블은 그 예외다. 명절·워크샵·
-- 소독·원장 사정처럼 요일 패턴으로 표현할 수 없는 하루가 실제로 있고, 등원 예약이 생긴
-- 뒤로는 이걸 표현하지 못하면 매장이 쉬는 날에 보호자가 예약을 잡는다. 그 실패는 아이를
-- 데리고 현관에 도착해서야 드러나고 되돌릴 수 없다.
--
-- 왜 business_hours JSONB 안이 아닌가: 운영시간은 7일짜리 고정 크기 값 객체라 통째로
-- 쓰기가 맞았지만, 휴무일은 계속 쌓이고 개별로 추가·삭제된다. JSONB 배열에 넣으면 휴무일
-- 하나를 추가할 때마다 운영시간 전체를 다시 써야 하고, 그 사이 다른 탭에서 시간표를
-- 고치면 한쪽이 통째로 사라진다. 날짜 범위 조회도 행이어야 인덱스를 탄다.
CREATE TABLE "tenant_closures" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    -- 사유는 보호자에게 그대로 보인다. "휴무"만 뜨면 보호자는 매장에 전화하지만,
    -- "설 연휴"·"정기 소독"이면 전화가 필요 없다.
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_closures_pkey" PRIMARY KEY ("id")
);

-- 같은 날을 두 번 넣으면 달력이 같은 휴무를 두 줄로 보여준다.
CREATE UNIQUE INDEX "tenant_closures_tenant_id_date_key" ON "tenant_closures"("tenant_id", "date");
-- "이 매장 · 이 달"이 유일한 조회 패턴이다(예약 달력 + 설정 화면).
CREATE INDEX "tenant_closures_tenant_id_date_idx" ON "tenant_closures"("tenant_id", "date");

ALTER TABLE "tenant_closures" ADD CONSTRAINT "tenant_closures_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 테넌트 스코프 모델이므로 RLS 를 나머지와 같은 모양으로 건다
-- (20260730090000_enable_tenant_rls 참고). 실제 격리는 Prisma Extension 이 하지만,
-- 정책이 빠진 테이블이 하나 생기면 그게 나중에 유일한 구멍이 된다.
ALTER TABLE "tenant_closures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_closures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "tenant_closures"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
