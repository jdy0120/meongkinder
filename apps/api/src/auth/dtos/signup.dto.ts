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
import type { SignupRequest, TermsAgreementInput } from "@pawlog/shared";

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
    description:
      "휴대폰 번호. 유치원이 이 번호로 미리 초대해 뒀다면 가입 즉시 소속 처리된다.",
    example: "010-1234-5678",
  })
  @IsOptional()
  @IsString()
  phone?: string;

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
