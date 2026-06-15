import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { BaseResponse } from "@template/shared";

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponse<unknown>> {
    return next.handle().pipe(
      map((data: unknown): BaseResponse<unknown> => {
        // 이미 BaseResponse 규격(result 필드가 존재함)일 경우 그대로 반환
        if (
          data &&
          typeof data === "object" &&
          "result" in (data as Record<string, unknown>)
        ) {
          const res = data as BaseResponse<unknown>;
          return {
            result: res.result,
            message: res.message || "요청 성공",
            data: res.data,
          };
        }
        return {
          result: true,
          message: "요청 성공",
          data,
        };
      }),
    );
  }
}
