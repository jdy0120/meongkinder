import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type {
  SubmitTermsAgreementRequest,
  TermsAgreementInput,
  CreateTermsRequest,
  UpdateTermsActiveRequest,
} from "@pawlog/shared";

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

export class CreateTermsDto implements CreateTermsRequest {
  @ApiProperty({ description: "약관 제목" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: "약관 구분 코드" })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ description: "약관 버전" })
  @IsString()
  @IsNotEmpty()
  version!: string;

  @ApiProperty({ description: "필수 여부" })
  @IsBoolean()
  @IsNotEmpty()
  isRequired!: boolean;

  @ApiProperty({ description: "활성화 여부" })
  @IsBoolean()
  @IsNotEmpty()
  isActive!: boolean;

  @ApiPropertyOptional({ description: "업로드된 약관 파일 ID (파일 관리 시)" })
  @IsString()
  @IsOptional()
  fileId?: string;
}

export class UpdateTermsActiveDto implements UpdateTermsActiveRequest {
  @ApiProperty({ description: "활성화 여부" })
  @IsBoolean()
  @IsNotEmpty()
  isActive!: boolean;
}
