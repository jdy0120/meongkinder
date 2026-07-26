import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";
import type { ResetPasswordRequest } from "@pawlog/shared";

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty({ description: "재설정 토큰 (이메일 링크에 포함)" })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: "새 비밀번호 (8자 이상)",
    example: "newpassword1234",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
