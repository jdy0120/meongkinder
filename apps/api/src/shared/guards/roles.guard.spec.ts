import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES } from "@pawlog/shared";
import type { MembershipRole, PlatformRole } from "@pawlog/shared";

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

/**
 * job-033 이후의 요청 모양을 흉내내는 ExecutionContext 목.
 *
 *  - user            : JWT 에서 온 플랫폼 레벨 정보 (tenantId 클레임은 더 이상 없다)
 *  - tenantMembership: TenantMiddleware 가 활성 테넌트의 ACTIVE 멤버십을 확인한 뒤 채운다.
 *                      값이 없으면 "테넌트 컨텍스트 없음"(개인 스코프)을 뜻한다.
 */
function createContext(
  user?: { role: PlatformRole },
  tenantMembership?: { tenantId: string; role: MembershipRole },
): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user, tenantMembership }),
    }),
  } as unknown as ExecutionContext;
}

const platformUser = { role: ROLES.USER } as const;
const superAdmin = { role: ROLES.SUPER_ADMIN } as const;

const membership = (role: MembershipRole) => ({ tenantId: "t1", role });

describe("RolesGuard", () => {
  describe("통과 조건 (역할 검사 없음)", () => {
    it("@Public 이면 user/roles 와 무관하게 통과", () => {
      const guard = new RolesGuard(createReflector({ isPublic: true }));
      expect(guard.canActivate(createContext())).toBe(true);
    });

    it("@Roles 미지정이면 인증된 사용자는 통과", () => {
      const guard = new RolesGuard(createReflector({ roles: undefined }));
      expect(guard.canActivate(createContext(platformUser))).toBe(true);
    });

    it("@Roles 가 빈 배열이면 통과", () => {
      const guard = new RolesGuard(createReflector({ roles: [] }));
      expect(guard.canActivate(createContext(platformUser))).toBe(true);
    });

    it("@Roles 지정 + 미인증(user 없음) → ForbiddenException", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.TENANT_ADMIN] }),
      );
      expect(() => guard.canActivate(createContext(undefined))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe("실효 역할 = 활성 테넌트의 멤버십 역할", () => {
    it("TENANT_ADMIN 멤버십 + @Roles(TENANT_ADMIN) → 통과", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.TENANT_ADMIN] }),
      );
      expect(
        guard.canActivate(
          createContext(platformUser, membership(ROLES.TENANT_ADMIN)),
        ),
      ).toBe(true);
    });

    it("STAFF 멤버십 + @Roles(STAFF, TENANT_ADMIN) → 통과", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.STAFF, ROLES.TENANT_ADMIN] }),
      );
      expect(
        guard.canActivate(createContext(platformUser, membership(ROLES.STAFF))),
      ).toBe(true);
    });

    it("STAFF 멤버십 + @Roles(TENANT_ADMIN) → ForbiddenException (승격 불가)", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.TENANT_ADMIN] }),
      );
      expect(() =>
        guard.canActivate(createContext(platformUser, membership(ROLES.STAFF))),
      ).toThrow(ForbiddenException);
    });

    it("GUARDIAN 멤버십 + @Roles(STAFF) → ForbiddenException", () => {
      const guard = new RolesGuard(createReflector({ roles: [ROLES.STAFF] }));
      expect(() =>
        guard.canActivate(
          createContext(platformUser, membership(ROLES.GUARDIAN)),
        ),
      ).toThrow(ForbiddenException);
    });

    it("같은 계정이라도 테넌트가 바뀌면 실효 역할이 바뀐다", () => {
      // A 매장에서는 관리자, B 매장에서는 보호자 — 한 회원이 여러 자격을 갖는 핵심 시나리오.
      const adminOnly = new RolesGuard(
        createReflector({ roles: [ROLES.TENANT_ADMIN] }),
      );

      expect(
        adminOnly.canActivate(
          createContext(platformUser, {
            tenantId: "tenant-a",
            role: ROLES.TENANT_ADMIN,
          }),
        ),
      ).toBe(true);

      expect(() =>
        adminOnly.canActivate(
          createContext(platformUser, {
            tenantId: "tenant-b",
            role: ROLES.GUARDIAN,
          }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe("테넌트 컨텍스트가 없으면 개인 스코프(USER)", () => {
    it("멤버십 없음 + @Roles(TENANT_ADMIN) → ForbiddenException", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.TENANT_ADMIN] }),
      );
      expect(() => guard.canActivate(createContext(platformUser))).toThrow(
        ForbiddenException,
      );
    });

    it("멤버십 없음 + @Roles(USER) → 통과 (내 펫 관리 등 개인 라우트)", () => {
      const guard = new RolesGuard(createReflector({ roles: [ROLES.USER] }));
      expect(guard.canActivate(createContext(platformUser))).toBe(true);
    });
  });

  describe("SUPER_ADMIN", () => {
    // 이 코드베이스의 규약: SUPER_ADMIN 은 테넌트 역할을 암묵적으로 상속하지 않는다.
    // 접근이 필요한 라우트는 @Roles(TENANT_ADMIN, SUPER_ADMIN) 처럼 명시적으로 나열한다
    // (AdminController, AttendanceController 등이 모두 이 형태다).
    it("SUPER_ADMIN 이 나열되지 않은 테넌트 역할 라우트는 통과하지 못한다", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.TENANT_ADMIN] }),
      );
      expect(() => guard.canActivate(createContext(superAdmin))).toThrow(
        ForbiddenException,
      );
    });

    it("SUPER_ADMIN 이 함께 나열된 라우트는 멤버십 없이도 통과한다", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN] }),
      );
      expect(guard.canActivate(createContext(superAdmin))).toBe(true);
    });

    it("@Roles(SUPER_ADMIN) 라우트는 테넌트 관리자가 통과할 수 없다", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.SUPER_ADMIN] }),
      );
      expect(() =>
        guard.canActivate(
          createContext(platformUser, membership(ROLES.TENANT_ADMIN)),
        ),
      ).toThrow(ForbiddenException);
    });

    it("테넌트로 전환(멤버십 주입)해도 SUPER_ADMIN 자격이 유지된다", () => {
      const guard = new RolesGuard(
        createReflector({ roles: [ROLES.SUPER_ADMIN] }),
      );
      expect(
        guard.canActivate(
          createContext(superAdmin, membership(ROLES.GUARDIAN)),
        ),
      ).toBe(true);
    });
  });
});
