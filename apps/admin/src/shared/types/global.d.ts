import "@tanstack/react-query";
import type { AxiosError } from "axios";
import type { BaseResponse } from "@template/shared";

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: AxiosError<BaseResponse<unknown>>;
  }
}
