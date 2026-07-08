/**
 * 성공 응답에서 message 가 런타임에 결정되는 경우(예: 전체취소/부분취소) 사용하는 마커.
 * 서비스가 `return new ResponseEnvelope(payload, message)` 로 반환하면
 * TransformInterceptor 가 instanceof 로 식별해 { result, message, data: payload } 로 감싼다.
 *
 * payload 의 키를 추측하지 않으므로, payload 에 `message` 필드가 있어도 안전하다.
 */
export class ResponseEnvelope<T = unknown> {
  constructor(
    public readonly data: T,
    public readonly message: string,
  ) {}
}
