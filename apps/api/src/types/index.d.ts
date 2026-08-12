import type { MembershipRole, PlatformRole } from "@pawlog/shared";

export {};

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      /** 플랫폼 레벨 역할 (JWT 클레임). 테넌트 안에서의 역할은 Request.tenantMembership 이 갖는다. */
      role: PlatformRole;
      refreshToken?: string;
    }

    interface Request {
      /**
       * 활성 테넌트와 그 안에서의 자격 (job-033).
       * TenantMiddleware 가 서브도메인/`X-Tenant-Id` 로 테넌트를 정하고 요청자의 ACTIVE 멤버십을
       * 확인해 채운다. 테넌트 컨텍스트가 없는 개인 스코프 요청(내 펫 관리 등)에서는 undefined.
       * RolesGuard 가 이 값으로 실효 역할을 판정한다.
       */
      tenantMembership?: {
        tenantId: string;
        role: MembershipRole;
      };
    }
  }
}
