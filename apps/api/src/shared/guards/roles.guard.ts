import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES } from "@pawlog/shared";
import type { Role } from "@pawlog/shared";
import type { Request } from "express";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * 역할 기반 접근 제어 (job-033 개편).
 *
 * 역할이 두 층으로 나뉘면서, 요청의 **실효 역할**은 다음 순서로 정해진다.
 *   1) SUPER_ADMIN — 플랫폼 관리자는 테넌트와 무관하게 항상 SUPER_ADMIN.
 *   2) 활성 테넌트가 있으면 그 테넌트의 멤버십 역할 (TENANT_ADMIN | STAFF | GUARDIAN).
 *      TenantMiddleware 가 ACTIVE 멤버십을 확인한 뒤에만 채우므로, 값이 있다는 것 자체가
 *      "이 테넌트의 정상 구성원"임을 보증한다.
 *   3) 테넌트 컨텍스트가 없으면 USER — 소속과 무관한 개인 스코프(내 프로필, 내 펫).
 *
 * 덕분에 기존 `@Roles(ROLES.TENANT_ADMIN, ...)` 데코레이터는 그대로 두고도 멤버십 기반으로 동작한다.
 *
 * 테넌트 리소스의 교차 접근 차단은 더 이상 여기서 하지 않는다 — TenantMiddleware 의 멤버십 검증과
 * Prisma Extension 의 자동 스코프가 담당한다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("접근 권한이 없습니다.");
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      // @Roles 미지정 = 인증된 사용자면 통과.
      return true;
    }

    const effectiveRole = this.resolveEffectiveRole(request);
    if (!requiredRoles.includes(effectiveRole)) {
      throw new ForbiddenException("접근 권한이 없습니다.");
    }

    return true;
  }

  private resolveEffectiveRole(request: Request): Role {
    if (request.user?.role === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
    return request.tenantMembership?.role ?? ROLES.USER;
  }
}
