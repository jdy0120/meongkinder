import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma } from "@template/database";
import * as bcrypt from "bcryptjs";
import { LoginDto, RefreshDto, SignupDto } from "../dtos";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../shared/utils/jwt";
import * as CONST from "../../shared/constants";
import { RedisService } from "../../shared/redis/redis.service";

const BCRYPT_ROUNDS = 10;

// Redis 키 헬퍼 — refresh 토큰은 Redis 에서 관리
const refreshKey = (userId: string) => `refresh:${userId}`;

@Injectable()
export class AuthService {
  constructor(private readonly redis: RedisService) {}

  /** 회원가입 — 이메일 + 비밀번호(bcrypt 해시) */
  async signup(dto: SignupDto) {
    const exists = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException("이미 가입된 이메일입니다.");
    }

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: dto.email,
        nickname: dto.nickname,
        password: hashed,
      },
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
