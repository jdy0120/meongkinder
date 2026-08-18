import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length } from "class-validator";
import type {
  RequestPhoneOtpRequest,
  VerifyPhoneOtpRequest,
} from "@pawlog/shared";

/** 인증번호 발송 요청 (job-042). */
export class RequestPhoneOtpDto implements RequestPhoneOtpRequest {
  @ApiProperty({
    description: "본인확인할 휴대폰 번호. 하이픈 허용 — 서버가 숫자만 남긴다.",
    example: "010-1234-5678",
  })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

/** 인증번호 확인 요청. */
export class VerifyPhoneOtpDto implements VerifyPhoneOtpRequest {
  @ApiProperty({
    description: "인증번호를 받은 번호",
    example: "010-1234-5678",
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: "문자로 받은 6자리 인증번호", example: "123456" })
  @IsString()
  @Length(6, 6)
  code: string;
}
