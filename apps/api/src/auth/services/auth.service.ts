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
import { MailerService } from "@nestjs-modules/mailer";
import * as CONST from "../../shared/constants";
import * as crypto from "crypto";
import { RedisService } from "../../shared/redis/redis.service";

// OTP 유효시간 (5분)
const OTP_TTL_SEC = 5 * 60;

// Redis 키 헬퍼
const otpKey = (email: string) => `otp:${email}`;
const refreshKey = (userId: string) => `refresh:${userId}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly redis: RedisService,
  ) {}

  private generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
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

  /** 로그인 요청 — OTP 발급 후 Redis 에 5분간 저장 */
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

    // DB 대신 Redis 에 저장 (TTL 로 자동 만료 → 별도 정리 불필요)
    await this.redis.set(otpKey(dto.email), code, OTP_TTL_SEC);

    await this.sendOtpEmail(dto.email, code);

    return {
      message: "OTP가 발급되었습니다.",
    };
  }

  /** OTP 검증 → 토큰 발급. refresh 토큰은 Redis 에 저장 */
  async submitOTP(dto: SubmitOtpDto) {
    const user = await prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!user) {
      throw new UnauthorizedException("존재하지 않는 이메일입니다.");
    }

    const savedCode = await this.redis.get(otpKey(dto.email));
    // 없으면 만료됐거나 발급된 적 없음, 다르면 오답
    if (!savedCode || savedCode !== dto.otpToken) {
      throw new UnauthorizedException("유효하지 않은 인증번호입니다.");
    }

    // 일회용 OTP — 검증 성공 즉시 삭제
    await this.redis.del(otpKey(dto.email));

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // refresh 토큰을 Redis 에 저장 (TTL = refresh 만료). 이후 검증은 여기서 비교
    await this.redis.set(
      refreshKey(user.id),
      refreshToken,
      CONST.REFRESH_TOKEN_EXPIRED_IN_SEC,
    );

    return {
      message: "로그인이 완료되었습니다.",
      accessToken,
      refreshToken,
      user,
    };
  }

  /** 로그아웃 — Redis 에서 refresh 토큰 제거 */
  async logout(userId: string) {
    if (userId) {
      await this.redis.del(refreshKey(userId));
    }
    return {
      message: "로그아웃이 완료되었습니다.",
    };
  }

  /** refresh 토큰 재발급 — Redis 에 저장된 값과 대조 (빠른 검증) */
  async refresh(dto: RefreshDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    const savedToken = await this.redis.get(refreshKey(user.id));
    // Redis 에 없으면(만료/로그아웃) 또는 불일치면 거부
    if (!savedToken || savedToken !== dto.refreshToken) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 토큰 회전(rotation): 새 refresh 토큰으로 교체
    await this.redis.set(
      refreshKey(user.id),
      refreshToken,
      CONST.REFRESH_TOKEN_EXPIRED_IN_SEC,
    );

    return {
      accessToken,
      refreshToken,
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
