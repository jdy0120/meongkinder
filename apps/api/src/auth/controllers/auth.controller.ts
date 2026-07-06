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
import { JwtRefreshGuard } from "../../shared/guards/jwt-refresh.guard";
import { AUTH_ROUTES } from "../routes";
import { AuthService } from "../services";
import { LoginDto, SignupDto } from "../dtos";
import * as CONST from "../../shared/constants";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
};

@Controller(AUTH_ROUTES.v1.BASE)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post(AUTH_ROUTES.v1.SIGNUP)
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signupDto: SignupDto) {
    const result = await this.authService.signup(signupDto);
    return {
      message: result.message,
      user: result.user,
    };
  }

  @Public()
  @Post(AUTH_ROUTES.v1.LOGIN)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);

    res.cookie("access_token", result.accessToken, {
      ...cookieOptions,
      maxAge: CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
    });
    res.cookie("refresh_token", result.refreshToken, {
      ...cookieOptions,
      maxAge: CONST.REFRESH_TOKEN_EXPIRED_IN_MILL_SEC,
    });

    // 토큰은 httpOnly 쿠키로만 내려간다. 본문에는 토큰을 포함하지 않는다.
    return {
      message: result.message,
      user: result.user,
    };
  }

  @Post(AUTH_ROUTES.v1.LOGOUT)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = req.user?.userId || "";
    const result = await this.authService.logout(userId);
    res.clearCookie("access_token", cookieOptions);
    res.clearCookie("refresh_token", cookieOptions);
    return {
      message: result.message,
    };
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
    res.cookie("access_token", result.accessToken, {
      ...cookieOptions,
      maxAge: CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
    });
    res.cookie("refresh_token", result.refreshToken, {
      ...cookieOptions,
      maxAge: CONST.REFRESH_TOKEN_EXPIRED_IN_MILL_SEC,
    });
    return result;
  }

  @Get(AUTH_ROUTES.v1.MYPAGE)
  @HttpCode(HttpStatus.OK)
  async mypage(@Req() req: Request) {
    const userId = req.user?.userId;
    const result = await this.authService.mypage(userId);
    return {
      message: result.message,
      user: result.user,
    };
  }
}
