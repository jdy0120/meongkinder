// 토스페이먼츠 설정
// 시크릿 키는 서버에만 보관합니다. (클라이언트는 클라이언트 키만 사용)
// 키 발급: https://developers.tosspayments.com

const secretKey = process.env.TOSS_SECRET_KEY;

export const tossConfig = {
  secretKey,
  baseUrl: "https://api.tosspayments.com/v1",
  // 시크릿 키가 설정된 경우에만 활성화 (미설정 시 결제 API 호출을 막음)
  isConfigured: Boolean(secretKey),
};

/**
 * 토스 API 인증 헤더 (HTTP Basic).
 * "시크릿키:" 을 base64 인코딩합니다. (비밀번호는 비움)
 */
export const tossAuthHeader = () =>
  `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
