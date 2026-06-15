import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma } from "@template/database";
import { LoginDto, RefreshDto, SubmitOtpDto } from "../dtos";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../shared/utils/jwt";
import * as CONST from "../../shared/constants";
import { MailerService } from "@nestjs-modules/mailer";

@Injectable()
export class AuthService {
  constructor(private readonly mailerService: MailerService) {}

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendOtpEmail(email: string, code: string) {
    const subject = `[Media Art Nation Admin] OTP 인증번호 발송`;
    const text = `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>이메일 인증 코드</h2>
            <p>아래의 인증 코드를 입력하여 인증을 완료해 주세요.</p>
            <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">
              ${code}
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">이 코드는 5분간 유효합니다.</p>
          </div>
          `;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: subject,
        html: text,
      });
    } catch {
      throw new InternalServerErrorException(
        "이메일 전송 중 오류가 발생했습니다. 관리자에게 문의해주세요.",
      );
    }
  }

  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!user) {
      throw new UnauthorizedException("존재하지 않는 이메일입니다.");
    }

    const code = this.generateOTP();

    await prisma.otpToken.upsert({
      where: {
        userId: user.id,
      },
      update: {
        code: code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5분 후
      },
      create: {
        userId: user.id,
        code: code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5분 후
      },
    });

    await this.sendOtpEmail(dto.email, code);

    return {
      message: "OTP가 발급되었습니다.",
    };
  }

  async submitOTP(dto: SubmitOtpDto) {
    const user = await prisma.user.findUnique({
      where: {
        email: dto.email,
      },
      include: {
        otpToken: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException("존재하지 않는 이메일입니다.");
    }

    const otp = user.otpToken;
    if (!otp || otp.code !== dto.otpToken) {
      throw new UnauthorizedException("유효하지 않은 인증번호입니다.");
    }

    if (otp.expiresAt < new Date()) {
      throw new UnauthorizedException(
        "만료된 인증번호입니다. 다시 발급해주세요.",
      );
    }

    // 일회용 OTP이므로 검증 성공 후 삭제 처리
    await prisma.otpToken.delete({
      where: {
        userId: user.id,
      },
    });

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const now = new Date();
    const accessTokenExpiresAt = new Date(
      now.getTime() + CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
    );
    const refreshTokenExpiresAt = new Date(
      now.getTime() + CONST.REFRESH_TOKEN_EXPIRED_IN_MILL_SEC,
    );

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken,
        accessTokenExpiresAt,
        refreshToken,
        refreshTokenExpiresAt,
      },
    });

    return {
      message: "로그인이 완료되었습니다.",
      user: updatedUser,
    };
  }

  async logout(userId: string) {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        accessToken: null,
        accessTokenExpiresAt: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
      },
    });
    return {
      message: "로그아웃이 완료되었습니다.",
    };
  }

  async refresh(dto: RefreshDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.refreshToken || user.refreshToken !== dto.refreshToken) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    if (user.refreshTokenExpiresAt && new Date() > user.refreshTokenExpiresAt) {
      throw new UnauthorizedException(
        "만료된 Refresh 토큰입니다. 다시 로그인해주세요.",
      );
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const now = new Date();
    const accessTokenExpiresAt = new Date(
      now.getTime() + CONST.ACCESS_TOKEN_EXPIRED_IN_MILL_SEC,
    );
    const refreshTokenExpiresAt = new Date(
      now.getTime() + CONST.REFRESH_TOKEN_EXPIRED_IN_MILL_SEC,
    );

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken,
        accessTokenExpiresAt,
        refreshToken,
        refreshTokenExpiresAt,
      },
    });

    return {
      accessToken: updatedUser.accessToken,
      refreshToken: updatedUser.refreshToken,
    };
  }

  async mypage(userId: string | undefined) {
    if (!userId) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException("존재하지 않는 사용자입니다.");
    }
    return {
      message: "마이페이지 정보입니다.",
      user,
    };
  }
}
