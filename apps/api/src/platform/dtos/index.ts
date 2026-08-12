import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import {
  PLATFORM_ROLES,
  type CreatePlatformUserRequest,
  type PlatformRole,
} from "@pawlog/shared";

import { PaginationQueryDto } from "../../shared/dtos";

/** 계정 상태 — (checkauth) 레이아웃이 로그인 이후 흐름을 가르는 값. */
const USER_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;

/**
 * 운영자 대행 계정 발급.
 *
 * 약관 동의(`agreements`)를 **일부러 받지 않는다** — 동의는 본인만 할 수 있고, 대신 눌러주면
 * 동의 기록이 거짓이 된다. 미동의 상태로 만들어지고 본인이 처음 `apps/web` 에 들어올 때
 * 최초 진입 게이트(`/welcome`, job-041)가 받는다.
 */
export class CreatePlatformUserDto implements CreatePlatformUserRequest {
  @ApiProperty({ description: "이메일", example: "staff@pawlog.co.kr" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: "초기 비밀번호 (8자 이상)" })
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
      "휴대폰 번호. 매장이 이 번호로 미리 등록해 둔 아이/초대가 있으면 생성 즉시 연결된다.",
    example: "010-1234-5678",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: "플랫폼 역할 (생략 시 USER)",
    enum: PLATFORM_ROLES,
  })
  @IsOptional()
  @IsIn(PLATFORM_ROLES)
  role?: PlatformRole;
}

export class UpdatePlatformUserStatusDto {
  @ApiProperty({ description: "계정 상태", enum: USER_STATUSES })
  @IsIn(USER_STATUSES)
  status: (typeof USER_STATUSES)[number];
}

export class UpdatePlatformUserRoleDto {
  @ApiProperty({
    description:
      "플랫폼 역할. 테넌트 역할(GUARDIAN/STAFF/TENANT_ADMIN)은 멤버십 API 로 변경한다.",
    enum: PLATFORM_ROLES,
  })
  @IsIn(PLATFORM_ROLES)
  role: PlatformRole;
}

/**
 * 회원 목록 필터.
 * PaginationQueryDto 를 상속해 whitelist 검증에서 role/status 가 잘리지 않게 한다.
 */
export class ListPlatformUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "플랫폼 역할 필터",
    enum: PLATFORM_ROLES,
  })
  @IsOptional()
  @IsIn(PLATFORM_ROLES)
  role?: PlatformRole;

  @ApiPropertyOptional({ description: "계정 상태 필터", enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: string;
}

export class ListSeatSubscriptionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "구독 상태 필터 (ACTIVE | CANCELED | EXPIRED | FAIL_PAUSED)",
  })
  @IsOptional()
  @IsString()
  status?: string;
}
