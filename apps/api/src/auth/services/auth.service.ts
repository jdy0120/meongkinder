import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { prisma } from "@template/database";
import * as bcrypt from "bcryptjs";
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
  SignupDto,
} from "../dtos";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../shared/utils/jwt";
import * as CONST from "../../shared/constants";
import { RedisService } from "../../shared/redis/redis.service";

const BCRYPT_ROUNDS = 10;

// Redis 키 헬퍼 — refresh 토큰은 Redis 에서 관리
const refreshKey = (userId: string) => `refresh:${userId}`;
// 비밀번호 재설정 토큰 — 랜덤 토큰을 Redis 에 저장(30분 TTL)
const resetKey = (token: string) => `reset:${token}`;
const RESET_TOKEN_EXPIRED_IN_SEC = 30 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly mailer: MailerService,
  ) {}

  /** 회원가입 — 이메일 + 비밀번호(bcrypt 해시) */
  async signup(dto: SignupDto) {
    const exists = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException("이미 가입된 이메일입니다.");
    }

    // 필수 약관 동의 체크
    const activeRequiredTerms = await prisma.terms.findMany({
      where: { isActive: true, isRequired: true },
    });

    for (const reqTerms of activeRequiredTerms) {
      const isAgreed = dto.agreements?.some(
        (a) => a.termsId === reqTerms.id && a.isAgreed === true,
      );
      if (!isAgreed) {
        throw new BadRequestException(
          `필수 약관 '${reqTerms.title}'에 동의해야 회원가입이 가능합니다.`,
        );
      }
    }

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          nickname: dto.nickname,
          password: hashed,
        },
      });

      if (dto.agreements && dto.agreements.length > 0) {
        await tx.userTermsAgreement.createMany({
          data: dto.agreements.map((ag) => ({
            userId: createdUser.id,
            termsId: ag.termsId,
            isAgreed: ag.isAgreed,
          })),
        });
      }

      return createdUser;
    });

    return {
      message: "회원가입이 완료되었습니다.",
      user,
    };
  }

  /** 로그인 — 비밀번호 검증 후 토큰 발급 (refresh 는 Redis 저장) */
  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    // 계정 존재/비밀번호 오류를 구분하지 않아 계정 열거를 방지
    if (!user || !user.password) {
      throw new UnauthorizedException(
        "이메일 또는 비밀번호가 올바르지 않습니다.",
      );
    }

    const matched = await bcrypt.compare(dto.password, user.password);
    if (!matched) {
      throw new UnauthorizedException(
        "이메일 또는 비밀번호가 올바르지 않습니다.",
      );
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

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

  /** refresh 토큰 재발급 — Redis 저장 값과 대조 */
  async refresh(dto: RefreshDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    const savedToken = await this.redis.get(refreshKey(user.id));
    if (!savedToken || savedToken !== dto.refreshToken) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 토큰 회전
    await this.redis.set(
      refreshKey(user.id),
      refreshToken,
      CONST.REFRESH_TOKEN_EXPIRED_IN_SEC,
    );

    return { accessToken, refreshToken };
  }

  /**
   * 비밀번호 찾기 — 재설정 토큰을 Redis 에 저장하고 이메일로 링크 발송.
   * 계정 열거(enumeration) 방지를 위해 사용자 존재 여부와 무관하게 동일 응답을 반환한다.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const token = randomBytes(32).toString("hex");
      await this.redis.set(
        resetKey(token),
        user.id,
        RESET_TOKEN_EXPIRED_IN_SEC,
      );

      // 메일 발송 실패가 계정 존재를 노출하지 않도록 내부에서 처리(로그만 남김).
      try {
        const webUrl = process.env.WEB_URL || "http://localhost:3001";
        const resetUrl = `${webUrl}/auth/reset-password?token=${token}`;
        await this.mailer.sendMail({
          to: user.email,
          subject: "[비밀번호 재설정] 요청하신 재설정 링크입니다.",
          html: `
            <p>아래 링크를 눌러 비밀번호를 재설정하세요. (30분 후 만료)</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
          `,
        });
      } catch (error) {
        this.logger.error(
          `비밀번호 재설정 메일 발송 실패 (userId=${user.id})`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return {
      message:
        "가입된 이메일이라면 비밀번호 재설정 링크를 발송했습니다. 메일함을 확인해주세요.",
    };
  }

  /**
   * 비밀번호 재설정 — Redis 의 토큰을 검증하고 비밀번호를 교체한다.
   * 성공 시 토큰과 기존 refresh 세션을 무효화한다.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const userId = await this.redis.get(resetKey(dto.token));
    if (!userId) {
      throw new BadRequestException("유효하지 않거나 만료된 토큰입니다.");
    }

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    // 사용된 토큰 제거 + 기존 로그인 세션(refresh) 무효화
    await this.redis.del(resetKey(dto.token));
    await this.redis.del(refreshKey(userId));

    return { message: "비밀번호가 변경되었습니다. 다시 로그인해주세요." };
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
