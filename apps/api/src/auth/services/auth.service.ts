import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { prisma, runWithoutTenant } from "@pawlog/database";
import { MEMBERSHIP_STATUS, type PlatformRole } from "@pawlog/shared";
import * as bcrypt from "bcryptjs";
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
  SignupDto,
  CompleteProfileDto,
  UpdateProfileDto,
} from "../dtos";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../shared/utils/jwt";
import * as CONST from "../../shared/constants";
import { RedisService } from "../../shared/redis/redis.service";
import {
  InvitationService,
  normalizePhone,
} from "../../membership/services/invitation.service";
import { FileService } from "../../shared/file/services/file.service";
import { PhoneOtpService } from "./phone-otp.service";

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
    private readonly invitationService: InvitationService,
    private readonly phoneOtp: PhoneOtpService,
    private readonly fileService: FileService,
  ) {}

  /** 회원가입 — 이메일 + 비밀번호(bcrypt 해시) */
  async signup(dto: SignupDto) {
    // job-033: 회원은 플랫폼 전역 정체성이다. 가입 시점에는 어떤 테넌트에도 속하지 않으며,
    // 유치원 소속은 이후 별도의 가입 신청(TenantMembership)으로 이뤄진다.
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
    // 회원/약관동의 모두 테넌트 스코프 밖의 전역 데이터라 bypass 컨텍스트에서 생성한다.
    const user = await runWithoutTenant(() =>
      prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: dto.email,
            nickname: dto.nickname,
            phone: dto.phone ? normalizePhone(dto.phone) : null,
            password: hashed,
          },
          omit: { password: true },
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
      }),
    );

    // job-034: 유치원이 이 사람의 이메일/전화번호로 미리 초대해 뒀다면 지금 소속 처리한다.
    // ("초대를 대체하는 자리표시자"가 실제 멤버십 + 펫으로 실현되는 지점)
    // 실패해도 가입 자체는 성공해야 하므로 claimForUser 내부에서 개별 실패를 흡수한다.
    const claimedInvitations = await this.invitationService.claimForUser(
      user.id,
      user.email,
      user.phone,
    );

    return { user, claimedInvitations: claimedInvitations.length };
  }

  /** 로그인 — 비밀번호 검증 후 토큰 발급 (refresh 는 Redis 저장) */
  async login(dto: LoginDto) {
    // job-033: 이메일이 플랫폼 전역 유니크이므로 테넌트와 무관하게 조회한다.
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
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

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as PlatformRole,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await this.redis.set(
      refreshKey(user.id),
      refreshToken,
      CONST.REFRESH_TOKEN_EXPIRED_IN_SEC,
    );

    const { password: _password, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  }

  /** 로그아웃 — Redis 에서 refresh 토큰 제거 */
  async logout(userId: string) {
    if (userId) {
      await this.redis.del(refreshKey(userId));
    }
    return null;
  }

  /** refresh 토큰 재발급 — Redis 저장 값과 대조 */
  async refresh(dto: RefreshDto) {
    // job-033: 이메일이 플랫폼 전역 유니크이므로 테넌트와 무관하게 조회한다.
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    const savedToken = await this.redis.get(refreshKey(user.id));
    if (!savedToken || savedToken !== dto.refreshToken) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as PlatformRole,
    };
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
    // job-033: 이메일이 플랫폼 전역 유니크이므로 테넌트와 무관하게 조회한다.
    const user = await prisma.user.findUnique({ where: { email: dto.email } });

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

    return null;
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

    return null;
  }

  async mypage(userId: string | undefined) {
    if (!userId) {
      throw new UnauthorizedException("유효하지 않은 토큰입니다.");
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      omit: { password: true },
    });
    if (!user) {
      throw new UnauthorizedException("존재하지 않는 사용자입니다.");
    }

    // job-033: JWT 가 더 이상 tenantId 를 담지 않으므로, 클라이언트는 여기서 받은 소속 목록에서
    // 활성 테넌트를 골라 `X-Tenant-Id` 헤더로 보낸다. 승인 대기(PENDING) 건도 내려보내
    // "승인 기다리는 중" 상태를 화면에 표시할 수 있게 한다.
    const memberships = await runWithoutTenant(() =>
      prisma.tenantMembership.findMany({
        where: {
          userId,
          status: {
            in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.PENDING],
          },
        },
        include: {
          tenant: {
            select: { id: true, name: true, subdomain: true, isActive: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    );

    // job-041: 아직 동의하지 않은 **활성 필수 약관**. 카카오 로그인은 약관 동의 절차를
    // 거치지 않으므로(social-auth.service.ts 는 UserTermsAgreement 를 만들지 않는다)
    // apps/web 사용자는 전원 이 목록이 비어 있지 않은 상태로 시작한다.
    //
    // 여기서 함께 내려주는 이유: (checkauth) 레이아웃이 이미 매 요청 mypage 를 호출하므로,
    // 게이트 판단을 위해 요청을 하나 더 만들 필요가 없다.
    const pendingRequiredTerms = await this.findPendingRequiredTerms(userId);

    return { user, memberships, pendingRequiredTerms };
  }

  /** 활성 필수 약관 중 이 회원이 아직 동의하지 않은 것들 */
  private async findPendingRequiredTerms(userId: string) {
    const requiredTerms = await prisma.terms.findMany({
      where: { isActive: true, isRequired: true },
      select: { id: true, title: true, type: true, version: true },
      orderBy: { createdAt: "asc" },
    });
    if (requiredTerms.length === 0) return [];

    const agreements = await prisma.userTermsAgreement.findMany({
      where: {
        userId,
        isAgreed: true,
        termsId: { in: requiredTerms.map((terms) => terms.id) },
      },
      select: { termsId: true },
    });
    const agreed = new Set(agreements.map((a) => a.termsId));

    return requiredTerms.filter((terms) => !agreed.has(terms.id));
  }

  /**
   * 최초 진입 완료 처리 (job-041) — 필수 약관 동의 + (선택) 전화번호.
   *
   * ## 순서가 중요하다
   *
   * 전화번호는 개인정보이고, 그것을 수집하는 근거가 개인정보처리방침 동의다. 그래서
   * **약관을 먼저 검증하고, 통과한 경우에만 번호를 저장한다.** 화면에서 같은 폼이더라도
   * 서버에서 이 순서가 뒤집히면 동의 없이 개인정보를 받은 것이 된다.
   *
   * ## 전화번호는 선택이다
   *
   * 매장에 다니지 않는 개인 보호자에게는 번호가 필요 없고, 첫 화면에서 막으면 이탈한다.
   * 대신 건너뛰면 **가입 전 유치원이 등록해 둔 아이·알림장을 연결할 수 없다** — 그 연결의
   * 유일한 키가 번호이기 때문이고, 화면에서 그렇게 안내한다. 나중에 프로필에서 번호를
   * 넣으면 `updateProfile` 이 같은 claim 을 다시 돌린다.
   *
   * ⚠️ TODO(job-042): 번호는 **자기신고**다. 남의 번호를 입력하면 그 아이의 알림장·사진에
   * 접근할 수 있었다(claimForUser → ACTIVE 멤버십 + 펫 소유권). job-042 에서 SMS OTP 를
   * 붙여, 이제 **본인확인을 통과한 번호만** claim 에 넘어간다(`phoneOtp.assertVerified`).
   * 단 `ALLOW_UNVERIFIED_PHONE=true` 면 그 검사를 건너뛴다 — 그동안은 이 경로가 다시
   * 신뢰 경계가 되므로 부팅 로그가 매번 그 사실을 알린다.
   */
  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      omit: { password: true },
    });
    if (!user) {
      throw new UnauthorizedException("존재하지 않는 사용자입니다.");
    }

    // ── 1. 필수 약관 검증 (번호를 만지기 전에) ────────────────────────────
    const pending = await this.findPendingRequiredTerms(userId);
    const agreedIds = new Set(
      (dto.agreements ?? [])
        .filter((agreement) => agreement.isAgreed === true)
        .map((agreement) => agreement.termsId),
    );

    const missing = pending.filter((terms) => !agreedIds.has(terms.id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `필수 약관 '${missing.map((terms) => terms.title).join(", ")}'에 동의해야 합니다.`,
      );
    }

    // ── 2. 동의 기록 + (선택) 전화번호 ────────────────────────────────────
    const phone = dto.phone ? normalizePhone(dto.phone) : undefined;

    // job-042: 번호를 저장하기 전에 본인확인을 통과해야 한다. 이 번호가 곧 소유권의
    // 열쇠라(claimForUser → ACTIVE 멤버십 + 펫 소유권), 자기신고를 그대로 믿으면 남의
    // 번호를 입력하는 것만으로 그 아이의 알림장·사진에 닿는다.
    //
    // ⚠️ 약관 검증 **뒤**, 저장 **앞**이다. 번호는 개인정보이고 수집 근거가 그 동의라
    // 순서가 뒤집히면 동의 없이 개인정보를 받은 것이 된다(job-041).
    if (phone) await this.phoneOtp.assertVerified(userId, phone);

    const updated = await prisma.$transaction(async (tx) => {
      if ((dto.agreements ?? []).length > 0) {
        // 같은 약관을 두 번 눌러도 로우가 쌓이지 않게 지우고 다시 넣는다.
        await tx.userTermsAgreement.deleteMany({
          where: {
            userId,
            termsId: { in: (dto.agreements ?? []).map((a) => a.termsId) },
          },
        });
        await tx.userTermsAgreement.createMany({
          data: (dto.agreements ?? []).map((agreement) => ({
            userId,
            termsId: agreement.termsId,
            isAgreed: agreement.isAgreed,
          })),
        });
      }

      if (phone === undefined) return user;

      return tx.user.update({
        where: { id: userId },
        data: { phone },
        omit: { password: true },
      });
    });

    // ── 3. 번호를 받았을 때만 비회원 시절 데이터를 잇는다 ─────────────────
    const claimed = phone
      ? await this.invitationService.claimForUser(userId, user.email, phone)
      : [];

    return { user: updated, claimedInvitations: claimed.length };
  }

  /**
   * 내 정보 수정 (job-039).
   *
   * 전화번호를 새로 넣으면 **대기 중인 초대를 다시 확인한다.** 카카오 로그인은 전화번호를
   * 주지 않으므로, 유치원이 전화번호로 미리 등록해 둔 초대는 이 시점에야 매칭될 수 있다.
   * (가입 시점의 claimForUser 는 전화번호가 없어 이메일만 맞춰봤다)
   */
  /**
   * 회원 프로필 사진을 영구 저장소로 올린다 (job-063).
   *
   * ⚠️ **`ownership: "shared"` 를 반드시 유지한다** (job-055 의 교훈). 파일의 테넌트는
   * 업로드한 요청의 스코프로 정해지는데, 회원은 여러 매장에 걸치거나 아무 데도 속하지
   * 않는다. 매장 화면에서 올린 사진이 매장 소유로 찍히면 개인 화면(`/profile`)에서 열 때
   * `assertReadable` 에 걸려 404 가 난다 — 펫 사진에서 이미 한 번 겪은 실패다.
   *
   * 승격 호출부를 늘리지 말고 이 함수만 쓸 것.
   */
  private promoteProfileImage(fileId?: string | null) {
    return this.fileService.promoteTempFile({
      fileId,
      domain: "user",
      newPath: "avatar",
      ownership: "shared",
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const phone = dto.phone ? normalizePhone(dto.phone) : undefined;

    // 아이의 알림 번호를 함께 옮기려면 **바꾸기 전 번호**를 알아야 한다. 뒤에서 읽으면
    // 이미 새 번호라 "옛 번호를 쓰던 아이"를 가려낼 수 없다.
    const before = await runWithoutTenant(() =>
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { phone: true },
      }),
    );

    // job-042: 번호를 저장하기 전에 본인확인을 통과해야 한다. 이 번호 하나로 그 번호에
    // 묶인 원생·알림장·사진의 소유권이 넘어가므로(claimForUser), 자기신고를 그대로
    // 믿으면 남의 번호를 입력하는 것만으로 남의 기록에 닿는다.
    //
    // ⚠️ **바뀔 때만** 요구한다. 내 정보 수정 폼은 번호 칸을 늘 함께 보내므로, 값이 같아도
    // 검사하면 **닉네임만 고치는 저장까지 전부 400 이 된다** — 화면은 저장 버튼이 눌리는데
    // 서버만 거절하니 사용자는 이유를 알 수 없다. 이미 저장돼 있는 번호는 저장될 때
    // 본인확인을 지난 값이므로 다시 물어봐야 할 새 사실이 없다.
    if (phone && phone !== before.phone) {
      await this.phoneOtp.assertVerified(userId, phone);
    }

    // job-063: 프로필 사진. 임시 업로드를 영구 저장소로 옮긴다.
    //
    // ⚠️ `ownership: "shared"` 가 핵심이다(job-055). 회원은 여러 매장에 걸치거나 아무
    // 데도 속하지 않으므로, 업로드한 요청의 스코프로 파일 테넌트를 정하면 다른 스코프에서
    // 열 때 404 가 난다 — 매장 화면에서 올린 사진이 개인 화면에서 안 보이는 식이다.
    await this.promoteProfileImage(dto.profileImageFileId);

    const user = await runWithoutTenant(() =>
      prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
          ...(phone !== undefined ? { phone } : {}),
          // 빈 문자열은 "지웠다"이므로 null 로 저장한다. 안 보낸 것(undefined)과 구분한다.
          ...(dto.profileImageFileId !== undefined
            ? { profileImageFileId: dto.profileImageFileId || null }
            : {}),
        },
        omit: { password: true },
      }),
    );

    const syncedPets = await this.syncPetGuardianPhones({
      userId,
      previousPhone: before.phone,
      newPhone: phone,
      petIds: dto.syncPetIds,
    });

    const claimed = phone
      ? await this.invitationService.claimForUser(user.id, user.email, phone)
      : [];

    return { user, claimedInvitations: claimed.length, syncedPets };
  }

  /**
   * 번호를 바꾼 회원이 고른 아이들의 알림 수신 번호를 함께 옮긴다 (job-060).
   *
   * 두 겹으로 막는다. **사용자가 골랐다는 것만으로는 부족하다** — id 는 요청 본문에
   * 실려 오므로 남의 아이 id 를 넣어볼 수 있다:
   *
   *   1. `userId` — 내 아이만.
   *   2. `guardianPhone = 바꾸기 전 번호` — 매장이 **일부러 다르게 적어 둔** 번호는
   *      건드리지 않는다. 부모 계정 + 자녀가 등하원을 맡는 경우가 그 형태라,
   *      덮으면 그 아이의 알림이 엉뚱한 곳으로 간다.
   *
   * 조건에 맞지 않는 id 는 조용히 지나간다(updateMany 라 0건 갱신). 요청을 실패시키면
   * 번호 변경 자체가 막히는데, 번호 변경은 더 급한 일이다.
   */
  private async syncPetGuardianPhones(params: {
    userId: string;
    previousPhone: string | null;
    newPhone?: string;
    petIds?: string[];
  }): Promise<number> {
    const { userId, previousPhone, newPhone, petIds } = params;

    // 번호를 안 바꿨거나, 옮길 아이를 고르지 않았거나, 바꾸기 전 번호가 없으면 할 일이 없다.
    if (!newPhone || !petIds?.length || !previousPhone) return 0;
    if (newPhone === previousPhone) return 0;

    const { count } = await runWithoutTenant(() =>
      prisma.pet.updateMany({
        where: {
          id: { in: petIds },
          userId,
          guardianPhone: previousPhone,
        },
        data: { guardianPhone: newPhone },
      }),
    );

    if (count !== petIds.length) {
      this.logger.warn(
        `알림 번호 동기화: 요청 ${petIds.length}건 중 ${count}건만 반영했습니다. ` +
          `(본인 소유가 아니거나 매장이 다른 번호를 적어 둔 아이는 건드리지 않습니다) userId=${userId}`,
      );
    }

    return count;
  }
}
