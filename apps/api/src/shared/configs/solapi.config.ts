// 솔라피(Solapi) 알림 중계사 설정 — 카카오 알림톡 발송 + 실패 시 SMS 폴백
// API 키/시크릿은 서버에만 보관합니다. 발급: https://solapi.com

import * as crypto from "crypto";

const apiKey = process.env.SOLAPI_API_KEY;
const apiSecret = process.env.SOLAPI_API_SECRET;
const senderPhone = process.env.SOLAPI_SENDER_PHONE; // 발신 번호 (사전 등록 필요)
const kakaoPfId = process.env.SOLAPI_KAKAO_PF_ID; // 카카오 채널(플러스친구) pfId

export const solapiConfig = {
  senderPhone,
  kakaoPfId,
  baseUrl: "https://api.solapi.com",
  // API 키/시크릿/발신번호가 설정된 경우에만 발송 활성화 (미설정 시 SMS/알림톡 호출을 막음)
  isConfigured: Boolean(apiKey && apiSecret && senderPhone),
  // 카카오 알림톡은 채널(pfId) 등록까지 되어야 시도 가능. 미설정이면 SMS 로만 발송한다.
  isKakaoConfigured: Boolean(apiKey && apiSecret && senderPhone && kakaoPfId),
};

// 알림톡 템플릿 코드 (Solapi 콘솔에서 사전 등록·승인 필요). 미설정 시 더미 코드로 대체.
export const solapiTemplates = {
  checkIn: process.env.SOLAPI_TEMPLATE_CHECK_IN ?? "PAWLOG_CHECK_IN",
  checkOutReport:
    process.env.SOLAPI_TEMPLATE_CHECK_OUT_REPORT ?? "PAWLOG_CHECK_OUT_REPORT",
  remainingCountLow:
    process.env.SOLAPI_TEMPLATE_REMAINING_COUNT_LOW ??
    "PAWLOG_REMAINING_COUNT_LOW",
  reservationReminder:
    process.env.SOLAPI_TEMPLATE_RESERVATION_REMINDER ??
    "PAWLOG_RESERVATION_REMINDER",
  feedPost: process.env.SOLAPI_TEMPLATE_FEED_POST ?? "PAWLOG_FEED_POST",
  tenantClosure:
    process.env.SOLAPI_TEMPLATE_TENANT_CLOSURE ?? "PAWLOG_TENANT_CLOSURE",
};

/**
 * 솔라피 API 인증 헤더 (HMAC-SHA256).
 * signature = HMAC-SHA256(date + salt, apiSecret) 를 hex 로 인코딩.
 * https://developers.solapi.com/references/authentication/api-key
 */
export const solapiAuthHeader = () => {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret ?? "")
    .update(date + salt)
    .digest("hex");

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
};
