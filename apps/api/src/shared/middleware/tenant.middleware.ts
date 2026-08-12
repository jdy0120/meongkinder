import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma, runWithoutTenant, runWithTenant } from "@pawlog/database";
import { MEMBERSHIP_STATUS, ROLES } from "@pawlog/shared";
import type { MembershipRole, PlatformRole } from "@pawlog/shared";

import * as CONST from "../constants";
import { getCookieName } from "../utils";
import { RESERVED_SUBDOMAINS } from "../utils/tenant";

// job-033: 토큰은 더 이상 tenantId 를 담지 않는다 (한 회원이 여러 테넌트에 속할 수 있으므로).
interface AccessTokenPayload {
  userId: string;
  email: string;
  role: PlatformRole;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_RE.test(value);

/** "acme.pawlog.com" → "acme". "acme.localhost" → "acme". "localhost"/"pawlog.com" → null. */
function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  const parts = host.split(".");
  if (parts.length < 2) return null;

  const candidate = parts[0];
  if (!candidate || RESERVED_SUBDOMAINS.has(candidate)) return null;

  return candidate;
}

function extractAccessToken(req: Request): string | null {
  const cookieToken = req.cookies?.[getCookieName("access_token")] as
    | string
    | undefined;
  if (cookieToken) return cookieToken;

  const authHeader = req.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return null;
}

/** 액세스 토큰을 검증해 페이로드를 반환한다. 토큰이 없거나 유효하지 않으면 null(미인증). */
function resolveJwtPayload(req: Request): AccessTokenPayload | null {
  const token = extractAccessToken(req);
  if (!token) return null;

  try {
    return jwt.verify(token, CONST.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * 활성 테넌트를 정하고 요청자의 소속 자격을 확인한다 (job-033).
 *
 * 해석 순서는 Host 서브도메인 → `X-Tenant-Id` 헤더다. JWT 폴백은 사라졌다 — 한 회원이 여러
 * 테넌트에 속할 수 있게 되면서 토큰이 테넌트를 지목할 수 없기 때문이다. 어느 쪽으로도 테넌트가
 * 정해지지 않으면 bypass 컨텍스트로 통과하며, 이는 "개인 스코프"를 뜻한다 — 내 프로필, 내 펫처럼
 * 테넌트를 가로지르는 회원 본인의 데이터만 다루는 요청이다.
 *
 * 테넌트가 정해지면 그 테넌트에 대한 **ACTIVE 멤버십**이 있어야만 통과한다. 승인 대기(PENDING)나
 * 반려/탈퇴 상태로는 어떤 리소스에도 접근할 수 없다. 통과 시 멤버십 역할을 `req.tenantMembership`
 * 에 실어 RolesGuard 가 실효 역할을 판정할 수 있게 한다.
 *
 * 예외는 두 가지다:
 *   1) 미인증 요청 — 로그인/회원가입/온보딩 등 부트스트랩. 보호 라우트는 JwtAccessGuard 가 막는다.
 *   2) SUPER_ADMIN — 어떤 테넌트에도 속하지 않는 플랫폼 관리자로, 전환이 정상 기능이다.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const payload = resolveJwtPayload(req);
    const tenant = await this.resolveTenant(req);

    if (!tenant) {
      // 개인 스코프 — 테넌트 스코프 모델은 자동 주입 없이 호출부가 userId 로 직접 좁힌다.
      return runWithoutTenant(() => next());
    }

    this.assertActive(tenant, payload);

    // 미인증 요청은 여기서 멤버십을 따지지 않는다(로그인 전이라 요청자가 없다).
    // 보호 라우트 접근은 이어지는 JwtAccessGuard 가 401 로 막는다.
    if (!payload) {
      return runWithTenant(tenant.id, () => next());
    }

    if (payload.role === ROLES.SUPER_ADMIN) {
      return runWithTenant(tenant.id, () => next());
    }

    const membership = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: { userId: payload.userId, tenantId: tenant.id },
      },
    });

    if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw new ForbiddenException(
        membership?.status === MEMBERSHIP_STATUS.PENDING
          ? "가입 승인 대기 중입니다. 관리자 승인 후 이용할 수 있습니다."
          : "해당 테넌트에 접근할 권한이 없습니다.",
      );
    }

    req.tenantMembership = {
      tenantId: tenant.id,
      role: membership.role as MembershipRole,
    };

    return runWithTenant(tenant.id, () => next());
  }

  /** Host 서브도메인 → `X-Tenant-Id` 헤더 순으로 활성 테넌트를 찾는다. */
  private async resolveTenant(
    req: Request,
  ): Promise<{ id: string; isActive: boolean } | null> {
    const subdomain = extractSubdomain(req.hostname);
    if (subdomain) {
      const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
      if (tenant) return tenant;
    }

    const headerTenantId = req.get("X-Tenant-Id");
    if (headerTenantId && isUuid(headerTenantId)) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: headerTenantId },
      });
      if (tenant) return tenant;
    }

    return null;
  }

  /**
   * 정지된 테넌트의 요청을 차단한다.
   * SUPER_ADMIN 은 예외 — 정지된 테넌트를 조회하고 다시 활성화하는 주체가 본인이라,
   * 여기서 막으면 테넌트 스위처로 정지 매장을 선택한 순간 스스로 잠겨버린다.
   */
  private assertActive(
    tenant: { isActive: boolean },
    payload: AccessTokenPayload | null,
  ): void {
    if (tenant.isActive) return;
    if (payload?.role === ROLES.SUPER_ADMIN) return;

    throw new ForbiddenException("비활성화된 테넌트입니다.");
  }
}
