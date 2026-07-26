import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { BaseResponse } from "@pawlog/shared";

import { RESPONSE_MESSAGE_KEY } from "../decorators/response-message.decorator";
import { ResponseEnvelope } from "../dtos/response-envelope";

/**
 * 모든 성공 응답을 BaseResponse({ result, message, data }) 로 감싼다.
 *
 * 핵심 규칙: **payload 의 키를 절대 검사하지 않는다.**
 * - message 는 @ResponseMessage 데코레이터(정적) 또는 ResponseEnvelope(동적)에서만 온다.
 * - 서비스 반환값은 그대로 data 가 된다. → payload 에 `message` 필드가 있어도 안전.
 * (오류 응답은 HttpErrorFilter 가 result:false 로 별도 처리)
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponse<unknown>> {
    const routeMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((payload: unknown): BaseResponse<unknown> => {
        // 동적 메시지: 서비스가 ResponseEnvelope 를 반환한 경우 (instanceof — 키 추측 없음)
        if (payload instanceof ResponseEnvelope) {
          return {
            result: true,
            message: payload.message,
            data: payload.data ?? null,
          };
        }

        // 정적 메시지: @ResponseMessage 데코레이터 값, 없으면 기본값.
        // payload 는 검사하지 않고 그대로 data 로 감싼다.
        return {
          result: true,
          message: routeMessage ?? "요청 성공",
          data: payload ?? null,
        };
      }),
    );
  }
}
