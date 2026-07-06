import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Role } from "@template/shared";

import * as CONST from "../constants";

interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          return (request?.cookies?.access_token as string) ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: CONST.ACCESS_TOKEN_SECRET,
    });
  }

  validate(payload: JwtPayload) {
    // Inject this object into request.user
    return { userId: payload.userId, email: payload.email, role: payload.role };
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
          return (request?.cookies?.refresh_token as string) ?? null;
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
      (req.cookies?.refresh_token as string) ??
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
