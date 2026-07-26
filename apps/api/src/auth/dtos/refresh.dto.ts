import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import type { RefreshRequest } from "@pawlog/shared";

export class RefreshDto implements RefreshRequest {
  @ApiProperty({ description: "이메일", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: "리프레시 토큰",
    example: "eyJhbGciOiJIUzI1NiIsIn...",
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
