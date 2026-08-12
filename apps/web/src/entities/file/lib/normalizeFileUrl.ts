import { getBaseUrl } from "@/shared/libs/axios/instance";

/**
 * GET v1/file/:fileId 가 반환한 url을 브라우저가 실제로 접근 가능한 주소로 보정한다.
 * LOCAL storage(raw 스트리밍 엔드포인트) URL은 서버가 `API_PUBLIC_URL`(미설정 시
 * http://localhost:{SERVER_PORT})로 절대경로를 조립하는데, 이 값이 브라우저가 API를 실제로
 * 호출하는 origin(getBaseUrl())과 다르면(dev: API_PUBLIC_URL 미설정, 실제 접근은 도메인 경유)
 * 이미지가 로드되지 않는다. `/{fileId}/raw` 로 끝나는 자체 API URL만 origin을 우리 쪽
 * getBaseUrl() 기준으로 다시 맞추고, 그 외(Azure Blob SAS URL 등 외부 URL)는 그대로 둔다.
 */
export const normalizeFileUrl = (url: string, fileId: string): string => {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.endsWith(`/${fileId}/raw`)) return url;

    return `${getBaseUrl()}/v1/file/${fileId}/raw`;
  } catch {
    return url;
  }
};
