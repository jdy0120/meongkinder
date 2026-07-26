import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES } from "@pawlog/shared";

import { RolesGuard } from "./roles.guard";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";

type Meta = { isPublic?: boolean; roles?: string[] };

/** 데코레이터 메타데이터를 흉내내는 Reflector 목 */
function createReflector(meta: Meta): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY) return meta.isPublic;
      if (key === ROLES_KEY) return meta.roles;
      return undefined;
    },
  } as unknown as Reflector;
}

/** req.user 를 담은 ExecutionContext 목 */
function createContext(user?: { role?: string }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("@Public 이면 user/roles 와 무관하게 통과", () => {
    const guard = new RolesGuard(createReflector({ isPublic: true }));
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it("@Roles 미지정이면 인증된 사용자는 통과", () => {
    const guard = new RolesGuard(createReflector({ roles: undefined }));
    expect(guard.canActivate(createContext({ role: ROLES.USER }))).toBe(true);
  });

  it("@Roles 가 빈 배열이면 통과", () => {
    const guard = new RolesGuard(createReflector({ roles: [] }));
    expect(guard.canActivate(createContext({ role: ROLES.USER }))).toBe(true);
  });

  it("@Roles(ADMIN) + ADMIN 사용자 → 통과", () => {
    const guard = new RolesGuard(createReflector({ roles: [ROLES.ADMIN] }));
    expect(guard.canActivate(createContext({ role: ROLES.ADMIN }))).toBe(true);
  });

  it("@Roles(ADMIN) + USER 사용자 → ForbiddenException", () => {
    const guard = new RolesGuard(createReflector({ roles: [ROLES.ADMIN] }));
    expect(() =>
      guard.canActivate(createContext({ role: ROLES.USER })),
    ).toThrow(ForbiddenException);
  });

  it("@Roles(ADMIN) + 미인증(user 없음) → ForbiddenException", () => {
    const guard = new RolesGuard(createReflector({ roles: [ROLES.ADMIN] }));
    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
