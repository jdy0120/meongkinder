import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * 내 정보 수정 (job-039).
 *
 * 전화번호가 핵심이다 — 카카오 로그인은 전화번호를 주지 않으므로, 유치원이 전화번호로
 * 미리 등록해 둔 초대(TenantInvitation)와 매칭되려면 회원이 직접 입력해야 한다.
 * 저장 시 숫자만 남겨 정규화하고, 저장 직후 대기 중인 초대를 다시 확인한다.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: "닉네임" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nickname?: string;

  @ApiPropertyOptional({
    description: "휴대폰 번호. 하이픈 허용 — 저장 시 숫자만 남긴다.",
    example: "010-1234-5678",
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
