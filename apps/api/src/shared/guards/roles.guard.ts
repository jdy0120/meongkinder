import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@pawlog/shared";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * 역할 기반 접근 제어.
 * JwtAccessGuard 다음에 실행되어 req.user.role 을 검사한다.
 * - @Public 이면 통과
 * - @Roles 미지정이면 인증만으로 통과 (USER/ADMIN 모두)
 * - @Roles 지정 시 해당 역할을 가진 사용자만 통과
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

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (user && requiredRoles.includes(user.role)) return true;

    throw new ForbiddenException("접근 권한이 없습니다.");
  }
}
