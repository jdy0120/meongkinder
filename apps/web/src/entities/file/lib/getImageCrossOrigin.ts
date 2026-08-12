import { getBaseUrl } from "@/shared/libs/axios/instance";

/**
 * canvas 로 그릴 이미지의 crossOrigin 값을 결정한다.
 * - 자체 API(raw 스트리밍 엔드포인트, LOCAL storage)에서 오는 URL은 쿠키 인증이 필요하므로
 *   "use-credentials" 로 요청해야 캔버스가 오염(tainted)되지 않는다.
 * - Azure Blob SAS URL(CLOUD storage) 등 외부 도메인은 쿠키가 필요 없고, 자격 증명을 실어
 *   보내면 CORS 응답(Access-Control-Allow-Origin: *)과 충돌해 오히려 로드가 실패할 수 있으므로
 *   "anonymous" 로 요청한다.
 */
export const getImageCrossOrigin = (
  url: string,
): "use-credentials" | "anonymous" => {
  try {
    return new URL(url).origin === new URL(getBaseUrl()).origin
      ? "use-credentials"
      : "anonymous";
  } catch {
    return "anonymous";
  }
};
