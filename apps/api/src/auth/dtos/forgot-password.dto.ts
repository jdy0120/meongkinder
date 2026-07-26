import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";
import type { ForgotPasswordRequest } from "@pawlog/shared";

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty({ description: "가입 이메일", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
