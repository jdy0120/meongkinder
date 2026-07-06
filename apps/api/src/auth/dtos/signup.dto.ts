import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsArray,
  IsOptional,
  ValidateNested,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";
import type { SignupRequest, TermsAgreementInput } from "@template/shared";

export class TermsAgreementInputDto implements TermsAgreementInput {
  @ApiProperty({ description: "약관 ID" })
  @IsString()
  @IsNotEmpty()
  termsId!: string;

  @ApiProperty({ description: "동의 여부" })
  @IsBoolean()
  @IsNotEmpty()
  isAgreed!: boolean;
}

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

  @ApiPropertyOptional({
    description: "약관 동의 내역",
    type: [TermsAgreementInputDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TermsAgreementInputDto)
  agreements?: TermsAgreementInputDto[];
}
