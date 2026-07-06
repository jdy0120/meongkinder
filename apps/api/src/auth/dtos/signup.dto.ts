import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import type { SignupRequest } from "@template/shared";

export class SignupDto implements SignupRequest {
  @ApiProperty({ description: "이메일", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: "비밀번호 (8자 이상)", example: "password1234" })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: "닉네임", example: "홍길동" })
  @IsString()
  @IsNotEmpty()
  nickname: string;
}
