import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { PlatformRole } from "@pawlog/shared";

import * as CONST from "../constants";
import { getCookieName } from "../utils";

// job-033: 한 회원이 여러 테넌트에 속할 수 있으므로 토큰에 tenantId 를 담지 않는다.
// 활성 테넌트는 요청마다 서브도메인/`X-Tenant-Id` 로 정해지고 TenantMiddleware 가 멤버십을 검증한다.
interface JwtPayload {
  userId: string;
  email: string;
  role: PlatformRole;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          return (
            (request?.cookies?.[getCookieName("access_token")] as string) ??
            null
          );
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: CONST.ACCESS_TOKEN_SECRET,
    });
  }

  validate(payload: JwtPayload) {
    // Inject this object into request.user
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  }
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          return (
            (request?.cookies?.[getCookieName("refresh_token")] as string) ??
            null
          );
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: CONST.REFRESH_TOKEN_SECRET,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const refreshToken =
      (req.cookies?.[getCookieName("refresh_token")] as string) ??
      req.get("Authorization")?.replace("Bearer ", "").trim() ??
      "";

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
