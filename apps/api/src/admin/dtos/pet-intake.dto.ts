import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type { PetIntakeRequest } from "@pawlog/shared";
import { CreatePetDto } from "../../pet/dtos";

/**
 * 원생 등록 단일 진입점 (job-040).
 *
 * 원장이 아는 것은 전화번호뿐이므로 그것만 필수로 받고, 나머지는 서버가 분기한다.
 * `petId`(기존 아이 선택)와 `pet`(새 아이 입력)은 **둘 중 정확히 하나**여야 하며,
 * 그 검증은 조합 조건이라 서비스에서 한다(class-validator 로 표현하면 오히려 읽기 어렵다).
 */
export class PetIntakeDto implements PetIntakeRequest {
  @ApiProperty({
    description:
      "보호자 휴대폰 번호. 하이픈 유무 무관(서버에서 숫자만 남긴다).",
    example: "010-1234-5678",
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ description: "보호자 이름 (현장에서 받아 적은 이름)" })
  @IsOptional()
  @IsString()
  guardianName?: string;

  @ApiPropertyOptional({
    description: "보호자가 이미 등록해 둔 아이를 원생으로 받을 때 그 아이의 id",
  })
  @IsOptional()
  @IsString()
  petId?: string;

  @ApiPropertyOptional({
    description: "새 아이를 등록할 때의 아이 정보",
    type: CreatePetDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePetDto)
  pet?: CreatePetDto;
}

/** 전화번호 조회 쿼리 (`GET .../intake/lookup?phone=`) */
export class PetIntakeLookupDto {
  @ApiProperty({ description: "보호자 휴대폰 번호", example: "01012345678" })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}
