/**
 * 전화번호 취급 규칙 (job-043).
 *
 * **저장은 언제나 숫자만, 화면은 언제나 하이픈.**
 *
 * 왜 저장을 숫자만으로 통일하는가: 전화번호는 이 서비스에서 **매칭 키**다. 매장이
 * "010-1234-5678" 로 등록해 둔 아이를, 보호자가 "01012345678" 로 가입하며 찾는다.
 * 표기가 섞이면 같은 번호가 다른 값이 되어 그 연결이 조용히 실패한다(`claimForUser`).
 * 그래서 서버는 들어오는 모든 번호를 `normalizePhone` 으로 눌러 저장하고, 화면은
 * 읽는 순간 `formatPhone` 으로 되살린다.
 *
 * 프런트/백엔드가 같은 구현을 쓰도록 여기(shared) 에 둔다 — 예전엔 API 의 한 서비스
 * 파일 안에 있어서 웹에서 쓸 수 없었고, 그 결과 입력값이 그대로 저장되는 경로가 남았다.
 */

/** 한국 전화번호 최대 자릿수 (010-1234-5678). */
export const PHONE_MAX_DIGITS = 11;

/** "010-1234-5678" / "010 1234 5678" → "01012345678". 매칭 키를 한 형태로 통일한다. */
export const normalizePhone = (phone: string): string =>
  phone.replace(/[^0-9]/g, "");

/**
 * 숫자열 → 하이픈 표기. 입력 중간 상태도 자연스럽게 끊어준다.
 *
 * 지역번호는 서울(02)만 두 자리이고 나머지는 세 자리다. 뒤 4자리는 항상 가입자번호이므로
 * 그것을 먼저 떼고 남은 것을 가운데로 둔다 — 10자리(3-3-4)와 11자리(3-4-4)가 이 규칙
 * 하나로 같이 처리된다.
 *
 * @example formatPhone("01012345678")  // "010-1234-5678"
 * @example formatPhone("0212345678")   // "02-1234-5678"
 * @example formatPhone("0311234567")   // "031-123-4567"
 * @example formatPhone("010123")       // "010-123"  (입력 중)
 */
export const formatPhone = (value: string | null | undefined): string => {
  const digits = normalizePhone(value ?? "").slice(0, PHONE_MAX_DIGITS);
  if (!digits) return "";

  const headLength = digits.startsWith("02") ? 2 : 3;
  if (digits.length <= headLength) return digits;

  const head = digits.slice(0, headLength);
  const rest = digits.slice(headLength);
  if (rest.length <= 4) return `${head}-${rest}`;

  // 7자리 이하면 가운데 3자리(3-3-4), 그보다 길면 4자리(3-4-4).
  const middleLength = rest.length <= 7 ? 3 : 4;
  return `${head}-${rest.slice(0, middleLength)}-${rest.slice(middleLength)}`;
};
