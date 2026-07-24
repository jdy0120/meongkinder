import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../../shared/decorators/public.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { JwtRefreshGuard } from "../../shared/guards/jwt-refresh.guard";
import { AUTH_ROUTES } from "../routes";
import { AuthService } from "../services";
import {
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
} from "../dtos";
import * as CONST from "../../shared/constants";
import { getCookieName, getCookieOptions } from "../../shared/utils";

@Controller(AUTH_ROUTES.v1.BASE)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post(AUTH_ROUTES.v1.SIGNUP)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("회원가입이 완료되었습니다.")
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Public()
  @Post(AUTH_ROUTES.v1.FORGOT_PASSWORD)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    "가입된 이메일이라면 비밀번호 재설정 링크를 발송했습니다. 메일함을 확인해주세요.",
  )
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post(AUTH_ROUTES.v1.RESET_PASSWORD)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("비밀번호가 변경되었습니다. 다시 로그인해주세요.")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post(AUTH_ROUTES.v1.LOGIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("로그인이 완료되었습니다.")
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    const options = getCookieOptions();

    res.cookie(getCookieName("access_token"), result.accessToken, {
      ...options,
      maxAge: CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
    });
    res.cookie(getCookieName("refresh_token"), result.refreshToken, {
      ...options,
      maxAge: CONST.REFRESH_TOKEN_EXPIRED_IN_MILL_SEC,
    });

    // 토큰은 httpOnly 쿠키로만 내려간다. 본문에는 토큰을 포함하지 않는다.
    return { user: result.user };
  }

  @Post(AUTH_ROUTES.v1.LOGOUT)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("로그아웃이 완료되었습니다.")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = req.user?.userId || "";
    await this.authService.logout(userId);
    const options = getCookieOptions();
    res.clearCookie(getCookieName("access_token"), options);
    res.clearCookie(getCookieName("refresh_token"), options);
    return null;
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post(AUTH_ROUTES.v1.REFRESH)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = req.user?.email || "";
    const refreshToken = req.user?.refreshToken || "";
    const result = await this.authService.refresh({ email, refreshToken });
    const options = getCookieOptions();
    res.cookie(getCookieName("access_token"), result.accessToken, {
      ...options,
      maxAge: CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
    });
    res.cookie(getCookieName("refresh_token"), result.refreshToken, {
      ...options,
      maxAge: CONST.REFRESH_TOKEN_EXPIRED_IN_MILL_SEC,
    });
    return result;
  }

  @Get(AUTH_ROUTES.v1.MYPAGE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("마이페이지 정보입니다.")
  async mypage(@Req() req: Request) {
    const userId = req.user?.userId;
    return this.authService.mypage(userId);
  }
}
