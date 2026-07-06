import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";
import type { LoginRequest } from "@template/shared";

export class LoginDto implements LoginRequest {
  @ApiProperty({ description: "이메일", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
