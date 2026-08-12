// 카카오 로컬 API 설정 (job-059) — 주소를 좌표로 바꾸는 데 쓴다.
//
// 지도 제공자를 카카오로 고른 이유: 이 서비스는 이미 카카오 로그인을 쓰고, 국내 주소는
// 다음 우편번호 서비스가 사실상 표준이라 "주소 검색 → 좌표 변환"이 한 벤더 안에서 끝난다.
// 구글/네이버로 가면 주소 검색을 따로 붙여야 한다.

/**
 * REST API 키.
 *
 * 카카오 개발자 콘솔에서 **OAuth 의 client_id 와 로컬 API 의 REST 키는 같은 값**이므로,
 * 별도 키를 안 넣었으면 로그인용 키를 그대로 쓴다. 나중에 앱을 분리하고 싶어질 수 있어
 * 전용 변수를 먼저 본다.
 */
const restApiKey =
  process.env.KAKAO_REST_API_KEY || process.env.KAKAO_CLIENT_ID;

export const kakaoLocalConfig = {
  restApiKey,
  /** 주소 → 좌표. 문서: https://developers.kakao.com/docs/latest/ko/local/dev-guide */
  addressSearchUrl: "https://dapi.kakao.com/v2/local/search/address.json",
  /**
   * 키가 없으면 지오코딩을 아예 시도하지 않는다. 호출부는 좌표 없이 주소만 저장한다 —
   * 사람이 읽는 주소가 먼저이고, 좌표는 지도에 얹기 위한 부가 정보다.
   */
  isConfigured: Boolean(restApiKey),
  /** 외부 API 가 느려도 저장 자체는 끝나야 하므로 짧게 끊는다. */
  timeoutMs: Number(process.env.KAKAO_LOCAL_TIMEOUT_MS ?? 3000),
} as const;
