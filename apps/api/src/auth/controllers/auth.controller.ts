import {
  Controller,
  Post,
  Body,
  Query,
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
import { LoginDto, SubmitOtpDto } from "../dtos";
import * as CONST from "../../shared/constants";

@Controller(AUTH_ROUTES.v1.BASE)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get(AUTH_ROUTES.v1.LOGIN)
  @HttpCode(HttpStatus.OK)
  async login(@Query() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      message: result.message,
    };
  }

  @Public()
  @Post(AUTH_ROUTES.v1.SUBMIT_OTP)
  @HttpCode(HttpStatus.OK)
  async submitOTP(
    @Body() submitOtpDto: SubmitOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.submitOTP(submitOtpDto);
    res.cookie("access_token", result.user.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
    });
    res.cookie("refresh_token", result.user.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: CONST.REFRESH_TOKEN_EXPIRED_IN_MILL_SEC,
    });

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
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
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
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
    });
    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
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
