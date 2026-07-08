import { SetMetadata } from "@nestjs/common";

export const RESPONSE_MESSAGE_KEY = "responseMessage";

/**
 * 성공 응답의 message(BaseResponse.message)를 라우트 단에서 선언한다.
 * TransformInterceptor 가 이 메타데이터를 읽어 봉투 message 로 사용한다.
 * 런타임에 메시지가 바뀌는 경우엔 서비스에서 ResponseEnvelope 를 반환할 것.
 *
 * 예) @ResponseMessage("로그인이 완료되었습니다.")
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
