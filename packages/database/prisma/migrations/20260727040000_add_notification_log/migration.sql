-- CreateTable: 알림(카카오 알림톡/SMS) 발송 로그
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pet_id" TEXT,
    "attendance_id" TEXT,
    "daily_report_id" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "template_code" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'SOLAPI',
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs"("user_id");
CREATE INDEX "notification_logs_pet_id_idx" ON "notification_logs"("pet_id");
CREATE INDEX "notification_logs_type_idx" ON "notification_logs"("type");

ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
