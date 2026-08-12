import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import type { AdminCreatePetRequest } from "@pawlog/shared";
import { CreatePetDto } from "../../pet/dtos";

// 어드민이 보호자(사용자)를 직접 지정해 반려동물을 등록할 때 사용. 나머지 필드는 CreatePetDto 를 재사용한다.
export class AdminCreatePetDto
  extends CreatePetDto
  implements AdminCreatePetRequest
{
  @ApiProperty({ description: "반려동물을 등록할 보호자(사용자) ID" })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
