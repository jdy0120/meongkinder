import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type {
  SubmitTermsAgreementRequest,
  TermsAgreementInput,
} from "@template/shared";

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

export class SubmitTermsAgreementDto implements SubmitTermsAgreementRequest {
  @ApiProperty({
    description: "약관 동의 내역 목록",
    type: [TermsAgreementInputDto],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TermsAgreementInputDto)
  agreements!: TermsAgreementInputDto[];
}
