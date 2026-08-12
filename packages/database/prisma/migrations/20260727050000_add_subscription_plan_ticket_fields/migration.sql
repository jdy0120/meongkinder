-- AlterTable: SubscriptionPlan 에 상품 유형(횟수제/무제한/기간제) 및 판매 활성화 필드 추가
ALTER TABLE "subscription_plans" ADD COLUMN     "plan_type" TEXT NOT NULL DEFAULT 'RECURRING';
ALTER TABLE "subscription_plans" ADD COLUMN     "total_count" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN     "validity_days" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: UserSubscription 에 일시정지(휴회) 시작 시각 추가
ALTER TABLE "user_subscriptions" ADD COLUMN     "paused_at" TIMESTAMP(3);
