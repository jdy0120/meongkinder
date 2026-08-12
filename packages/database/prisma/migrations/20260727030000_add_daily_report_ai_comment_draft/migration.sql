-- 입력된 리포트 항목 기반 AI 코멘트 초안 저장 컬럼 추가
ALTER TABLE "daily_reports" ADD COLUMN "ai_comment_draft" TEXT;
