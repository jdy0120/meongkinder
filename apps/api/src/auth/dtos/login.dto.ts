import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import type { LoginRequest } from "@pawlog/shared";

export class LoginDto implements LoginRequest {
  @ApiProperty({ description: "이메일", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: "비밀번호", example: "password1234" })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
