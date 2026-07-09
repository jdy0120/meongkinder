import "@tanstack/react-query";
import type { AxiosError } from "axios";
import type { BaseResponse } from "@template/shared";

declare global {
  /**
   * 앱 공통 API 에러 타입.
   * axios 에러 + 백엔드 표준 응답(BaseResponse) 페이로드를 합친 형태로,
   * import 없이 전역에서 사용한다. (예: `catch` 좁히기, 명시 애노테이션)
   */
  type ApiError = AxiosError<BaseResponse<unknown>>;
}

declare module "@tanstack/react-query" {
  interface Register {
    // react-query 콜백(onError 등)의 error 를 공통 타입으로 자동 추론시킨다.
    defaultError: ApiError;
  }
}
