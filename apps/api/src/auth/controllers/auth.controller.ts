import {
  Controller,
  Patch,
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
  CompleteProfileDto,
  UpdateProfileDto,
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

  /**
   * 내 정보 수정 — 닉네임·전화번호.
   * 전화번호를 등록하면 그 번호로 와 있던 매장 초대가 자동으로 소속 처리된다.
   */
  @Patch(AUTH_ROUTES.v1.UPDATE_PROFILE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("내 정보가 수정되었습니다.")
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user!.userId, dto);
  }

  /**
   * 최초 진입 완료 (job-041) — 필수 약관 동의 + (선택) 전화번호.
   *
   * 카카오 로그인은 약관 동의를 거치지 않으므로 `apps/web` 사용자는 전원 이 경로를 지난다.
   * 전화번호를 함께 넣으면 그 번호로 등록돼 있던 아이·매장 초대가 계정에 연결된다.
   */
  @Post(AUTH_ROUTES.v1.COMPLETE_PROFILE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("설정이 완료되었습니다.")
  async completeProfile(@Req() req: Request, @Body() dto: CompleteProfileDto) {
    return this.authService.completeProfile(req.user!.userId, dto);
  }
}
