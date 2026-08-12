-- job-054: 판매 환불.
--
-- `canceled_at` 만으로는 **전액 취소밖에 표현할 수 없었다.** 10회권을 팔고 3회 쓴 뒤
-- 그만두는 경우가 실제로 흔한데, 그때 전액 취소로 처리하면 이미 제공한 3회분까지
-- 매출에서 사라져 장부가 매장에 불리하게 틀어진다.
--
-- 그래서 환불 금액을 따로 들고, 매출 집계를 `amount - refunded_amount` 로 바꾼다.

ALTER TABLE "tenant_sales" ADD COLUMN "refunded_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenant_sales" ADD COLUMN "refund_reason" TEXT;

-- 기존에 canceled_at 이 채워진 로우가 있다면 전액 환불로 해석한다.
-- (이 컬럼을 쓰는 코드가 아직 없어 실제로는 0건이지만, 순서가 바뀐 환경을 대비해 둔다.)
UPDATE "tenant_sales" SET "refunded_amount" = "amount" WHERE "canceled_at" IS NOT NULL;

-- 환불액이 판매액을 넘을 수 없다. 넘으면 그 달 매출이 음수가 되어 원장이 화면을 못 믿게 된다.
-- 애플리케이션에서도 막지만, 돈이 걸린 불변식이라 DB 에서도 굳힌다.
ALTER TABLE "tenant_sales"
  ADD CONSTRAINT "tenant_sales_refund_within_amount_ck"
  CHECK ("refunded_amount" >= 0 AND "refunded_amount" <= "amount");
