import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../shared/dtos";

/** 알림 발송 내역 목록 조회 쿼리 (페이지네이션 + 필터) */
export class NotificationLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "수신자(보호자) User ID" })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: "반려동물 ID" })
  @IsOptional()
  @IsString()
  petId?: string;

  @ApiPropertyOptional({
    description:
      "알림 유형 (CHECK_IN | CHECK_OUT_REPORT | REMAINING_COUNT_LOW | RESERVATION_REMINDER)",
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: "발송 상태 (SUCCESS | FAILED)" })
  @IsOptional()
  @IsString()
  status?: string;
}
