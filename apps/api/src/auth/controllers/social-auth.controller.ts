import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { isSocialProviderSlug } from "@template/shared";
import { Public } from "../../shared/decorators/public.decorator";
import { AUTH_ROUTES } from "../routes";
import { SocialAuthService } from "../services";
import * as CONST from "../../shared/constants";
import { getCookieName, getCookieOptions } from "../../shared/utils";

/**
 * 소셜 로그인 컨트롤러 (서버 리다이렉트 흐름).
 * 이메일 로그인과 동일하게 access/refresh 토큰은 httpOnly 쿠키로만 내려간다.
 */
@Controller(AUTH_ROUTES.v1.BASE)
export class SocialAuthController {
  constructor(private readonly socialAuth: SocialAuthService) {}

  /** 1단계 — provider 인증 페이지로 302 redirect */
  @Public()
  @Get(AUTH_ROUTES.v1.SOCIAL_AUTHORIZE)
  async authorize(@Param("provider") provider: string, @Res() res: Response) {
    if (!isSocialProviderSlug(provider)) {
      throw new BadRequestException("지원하지 않는 소셜 로그인입니다.");
    }
    const url = await this.socialAuth.buildAuthorizeUrl(provider);
    return res.redirect(url);
  }

  /** 2단계 — provider callback. 토큰 발급 후 web 으로 302 redirect */
  @Public()
  @Get(AUTH_ROUTES.v1.SOCIAL_CALLBACK)
  async callback(
    @Param("provider") provider: string,
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    if (!isSocialProviderSlug(provider)) {
      throw new BadRequestException("지원하지 않는 소셜 로그인입니다.");
    }
    if (!code) {
      return res.redirect(this.socialAuth.failureRedirect);
    }

    try {
      const { accessToken, refreshToken } =
        await this.socialAuth.handleCallback(provider, code, state);
      const options = getCookieOptions();

      res.cookie(getCookieName("access_token"), accessToken, {
        ...options,
        maxAge: CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
      });
      res.cookie(getCookieName("refresh_token"), refreshToken, {
        ...options,
        maxAge: CONST.REFRESH_TOKEN_EXPIRED_IN_MILL_SEC,
      });

      return res.redirect(this.socialAuth.successRedirect);
    } catch {
      // 실패 사유는 서비스에서 로깅됨. 사용자는 로그인 페이지로 되돌린다.
      return res.redirect(this.socialAuth.failureRedirect);
    }
  }
}
