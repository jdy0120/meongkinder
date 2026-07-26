import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import type { CreatePetRequest, UpdatePetRequest } from "@pawlog/shared";

export class CreatePetDto implements CreatePetRequest {
  @ApiProperty({ description: "이름" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "종 (예: DOG, CAT)" })
  @IsString()
  @IsNotEmpty()
  species!: string;

  @ApiPropertyOptional({ description: "품종" })
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({ description: "생년월일 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @ApiPropertyOptional({ description: "성별 (MALE | FEMALE)" })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: "중성화 여부" })
  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean;

  @ApiPropertyOptional({ description: "체중(kg)" })
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ description: "프로필 이미지 파일 ID" })
  @IsOptional()
  @IsString()
  profileImageFileId?: string;

  @ApiPropertyOptional({ description: "메모" })
  @IsOptional()
  @IsString()
  memo?: string;
}

export class UpdatePetDto implements UpdatePetRequest {
  @ApiPropertyOptional({ description: "이름" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "종 (예: DOG, CAT)" })
  @IsOptional()
  @IsString()
  species?: string;

  @ApiPropertyOptional({ description: "품종" })
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({ description: "생년월일 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @ApiPropertyOptional({ description: "성별 (MALE | FEMALE)" })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: "중성화 여부" })
  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean;

  @ApiPropertyOptional({ description: "체중(kg)" })
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ description: "프로필 이미지 파일 ID" })
  @IsOptional()
  @IsString()
  profileImageFileId?: string;

  @ApiPropertyOptional({ description: "메모" })
  @IsOptional()
  @IsString()
  memo?: string;
}
