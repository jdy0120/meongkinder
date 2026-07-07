import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { UpdateUserRequest } from "@template/shared";

// 계정 상태 (User.status 컬럼과 일치)
const USER_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;

export class UpdateUserDto implements UpdateUserRequest {
  @ApiPropertyOptional({ description: "닉네임" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nickname?: string;

  @ApiPropertyOptional({ description: "계정 상태", enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: string;
}
