import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class SubmitOtpDto {
  @ApiProperty({ description: "이메일", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: "OTP 번호 (6자리)", example: "123456" })
  @IsString()
  @IsNotEmpty()
  otpToken: string;
}
