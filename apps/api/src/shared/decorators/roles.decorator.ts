import { SetMetadata } from "@nestjs/common";
import type { Role } from "@pawlog/shared";

export const ROLES_KEY = "roles";

/**
 * 이 엔드포인트에 필요한 역할을 지정합니다.
 * 예) @Roles(ROLES.ADMIN)  → ADMIN 만 접근 가능
 * 지정하지 않으면 인증된 사용자면 누구나(USER 포함) 접근 가능합니다.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
