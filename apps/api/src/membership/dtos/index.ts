import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import {
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUS,
  type AcceptInvitationRequest,
  type ApplyMembershipRequest,
  type CreateInvitationRequest,
  type DecideMembershipRequest,
  type MembershipRole,
  type MembershipStatus,
  type UpdateMembershipRoleRequest,
} from "@pawlog/shared";

import { PaginationQueryDto } from "../../shared/dtos";

/** 관리자가 부여할 수 있는 역할 — 자기 자신을 포함한 모든 테넌트 역할. */
const ASSIGNABLE_ROLES = MEMBERSHIP_ROLES;

export class ApplyMembershipDto implements ApplyMembershipRequest {
  @ApiProperty({ description: "가입 신청할 테넌트 ID" })
  @IsString()
  @IsNotEmpty()
  tenantId: string;
}

export class DecideMembershipDto implements DecideMembershipRequest {
  @ApiProperty({
    description: "승인(ACTIVE) 또는 반려(REJECTED)",
    enum: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.REJECTED],
  })
  @IsIn([MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.REJECTED])
  status: Extract<MembershipStatus, "ACTIVE" | "REJECTED">;
}

export class UpdateMembershipRoleDto implements UpdateMembershipRoleRequest {
  @ApiProperty({ description: "변경할 역할", enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role: MembershipRole;
}

export class CreateInvitationDto implements CreateInvitationRequest {
  @ApiPropertyOptional({
    description: "부여할 역할 (미지정 시 GUARDIAN)",
    enum: ASSIGNABLE_ROLES,
  })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: MembershipRole;

  @ApiPropertyOptional({ description: "초대 대상 이메일 (phone 과 택일)" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "초대 대상 휴대폰 번호 (email 과 택일). 하이픈 허용",
    example: "010-1234-5678",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  // job-058: 아이 정보 칸(guardianName/petName/petSpecies/petBreed/petBirthDate/note)을
  // 없앴다. 초대는 **자격 부여 전용**이고, 미가입 보호자의 아이는 원생 등록 단일 진입점
  // (`POST v1/admin/pets/intake`) 이 맡는다 — 이유는 CreateInvitationRequest 주석 참고.
  //
  // ⚠️ ValidationPipe 가 `forbidNonWhitelisted: true` 라, 이 칸들을 실어 보내면 이제
  // 조용히 무시되지 않고 **400 으로 거절된다.** 죽은 경로를 눈치채지 못한 채 쓰는 것보다
  // 낫다고 보고 그대로 둔다.
}

export class AcceptInvitationDto implements AcceptInvitationRequest {
  @ApiProperty({ description: "초대 토큰" })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class LookupInvitationDto {
  @ApiProperty({ description: "초대 토큰" })
  @IsString()
  @IsNotEmpty()
  token: string;
}

/**
 * 구성원 목록 필터.
 * PaginationQueryDto 를 상속해 whitelist 검증에서 status/role 이 잘리지 않게 한다
 * (기존 daily-report/attendance 의 `?petId=` 가 잘리던 문제와 동일한 함정).
 */
export class ListMembershipsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "상태 필터",
    enum: Object.values(MEMBERSHIP_STATUS),
  })
  @IsOptional()
  @IsIn(Object.values(MEMBERSHIP_STATUS))
  status?: MembershipStatus;

  @ApiPropertyOptional({ description: "역할 필터", enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: MembershipRole;
}
