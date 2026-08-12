import { randomBytes } from "node:crypto";
import {
  Injectable,
  Logger,
  NotImplementedException,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma } from "@pawlog/database";
import {
  SOCIAL_PROVIDER_SLUGS,
  SOCIAL_PROVIDERS,
  type KakaoProfileResponse,
  type NormalizedSocialProfile,
  type SocialProvider,
  type SocialProviderSlug,
  type PlatformRole,
} from "@pawlog/shared";
import { env } from "../../shared/configs/env";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../shared/utils/jwt";
import * as CONST from "../../shared/constants";
import { RedisService } from "../../shared/redis/redis.service";
import { InvitationService } from "../../membership/services/invitation.service";

// refresh 토큰은 이메일 로그인과 동일하게 Redis 에서 관리한다.
const refreshKey = (userId: string) => `refresh:${userId}`;
// CSRF 방지용 state 토큰 (5분 TTL). authorize 시 저장, callback 에서 대조.
// job-036: 값에 "슬러그:출발앱" 을 함께 담는다 — 소셜 로그인은 브라우저 전체 리다이렉트라
// 콜백 시점에 어디서 시작했는지 알 방법이 이것뿐이고, admin 에서 시작한 로그인이 web 으로
// 튕기면 안 되기 때문이다.
const stateKey = (state: string) => `social_state:${state}`;
const STATE_TTL_SEC = 5 * 60;

/** 소셜 로그인을 시작한 앱. 콜백 후 돌아갈 곳을 정한다. */
export type SocialLoginOrigin = "web" | "admin";
const isOrigin = (value: string): value is SocialLoginOrigin =>
  value === "web" || value === "admin";

interface ProviderConfig<TRaw = any> {
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scope: string;
  // provider 별 raw 응답 → 공통 형태로 변환 (정규화 경계).
  normalize: (raw: TRaw, provider: SocialProvider) => NormalizedSocialProfile;
}

@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly invitationService: InvitationService,
  ) {}

  // ── provider 별 설정 ──────────────────────────────────────────────────────
  // authorize/token/profile URL 은 각 provider 문서 기준. scope·필드 매핑은 콘솔 설정에 맞춰 확인 필요.
  private readonly configs: Record<SocialProvider, ProviderConfig<any>> = {
    [SOCIAL_PROVIDERS.KAKAO]: {
      clientId: env.KAKAO_CLIENT_ID,
      clientSecret: env.KAKAO_CLIENT_SECRET,
      callbackUrl: env.KAKAO_CALLBACK_URL,
      authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
      tokenUrl: "https://kauth.kakao.com/oauth/token",
      profileUrl: "https://kapi.kakao.com/v2/user/me",
      // TODO(scope): 콘솔 [동의 항목]에서 사용 설정한 값과 일치시킬 것.
      scope: "profile_nickname account_email",
      normalize: (raw: KakaoProfileResponse, provider) => ({
        provider,
        providerAccountId: String(raw?.id ?? ""),
        email: raw?.kakao_account?.email ?? null,
        nickname: raw?.kakao_account?.profile?.nickname ?? null,
        avatarUrl: raw?.kakao_account?.profile?.profile_image_url ?? null,
      }),
    },
  };

  private toProvider(slug: SocialProviderSlug): SocialProvider {
    return SOCIAL_PROVIDER_SLUGS[slug];
  }

  private resolveCallbackUrl(slug: SocialProviderSlug, cfg: ProviderConfig) {
    if (cfg.callbackUrl) return cfg.callbackUrl;
    const base =
      env.API_PUBLIC_URL ??
      `http://localhost:${process.env.SERVER_PORT ?? 3000}`;
    const project = process.env.PROJECT_NAME ?? "template-dev";
    return `${base}/api/${project}/v1/auth/social/${slug}/callback`;
  }

  private ensureConfigured(cfg: ProviderConfig, provider: SocialProvider) {
    if (!cfg.clientId) {
      throw new NotImplementedException(
        `${provider} 소셜 로그인이 설정되지 않았습니다. (${provider}_CLIENT_ID 등 환경변수를 확인하세요)`,
      );
    }
  }

  /**
   * 1단계 — provider 인증 페이지로 보낼 authorize URL 을 만든다.
   * CSRF 방지용 state 를 Redis 에 저장한다.
   */
  async buildAuthorizeUrl(
    slug: SocialProviderSlug,
    origin: SocialLoginOrigin = "web",
  ): Promise<string> {
    const provider = this.toProvider(slug);
    const cfg = this.configs[provider];
    this.ensureConfigured(cfg, provider);

    const state = randomBytes(16).toString("hex");
    await this.redis.set(stateKey(state), `${slug}:${origin}`, STATE_TTL_SEC);

    const params = new URLSearchParams({
      client_id: cfg.clientId as string,
      redirect_uri: this.resolveCallbackUrl(slug, cfg),
      response_type: "code",
      state,
    });
    if (cfg.scope) params.set("scope", cfg.scope);

    return `${cfg.authorizeUrl}?${params.toString()}`;
  }

  /**
   * 2단계 — callback. code 를 토큰으로 교환하고 프로필을 받아 유저를 매핑한 뒤 JWT 를 발급한다.
   * 반환한 accessToken/refreshToken 은 컨트롤러에서 httpOnly 쿠키로 내려준다.
   */
  async handleCallback(slug: SocialProviderSlug, code: string, state: string) {
    const provider = this.toProvider(slug);
    const cfg = this.configs[provider];
    this.ensureConfigured(cfg, provider);

    // state 검증 (CSRF 방지) + 출발 앱 복원
    const saved = await this.redis.get(stateKey(state));
    const [savedSlug, savedOrigin] = (saved ?? "").split(":");
    if (!saved || savedSlug !== slug) {
      throw new UnauthorizedException("유효하지 않은 소셜 로그인 요청입니다.");
    }
    await this.redis.del(stateKey(state));
    const origin: SocialLoginOrigin =
      savedOrigin && isOrigin(savedOrigin) ? savedOrigin : "web";

    const accessToken = await this.exchangeCodeForToken(slug, cfg, code);
    const rawProfile = await this.fetchProfile(cfg, accessToken);
    const profile = cfg.normalize(rawProfile, provider);

    if (
      !profile.providerAccountId ||
      profile.providerAccountId === "undefined"
    ) {
      throw new UnauthorizedException("소셜 프로필을 가져오지 못했습니다.");
    }

    const { user, isNewUser } = await this.upsertUser(profile);

    // job-036: 인증이 카카오 단일 경로가 되면서, 이메일 회원가입에만 걸려 있던 초대 매칭이
    // 아예 실행되지 않게 됐다. 유치원이 미리 등록해 둔 초대를 여기서 소속으로 실현한다.
    // 매 로그인마다 확인한다 — 이미 가입한 회원을 나중에 초대하는 경우도 커버해야 하고,
    // 대기 중인 초대가 없으면 조회 한 번으로 끝난다.
    await this.invitationService.claimForUser(user.id, user.email, user.phone);

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as PlatformRole,
    };
    const jwtAccess = generateAccessToken(payload);
    const jwtRefresh = generateRefreshToken(payload);
    await this.redis.set(
      refreshKey(user.id),
      jwtRefresh,
      CONST.REFRESH_TOKEN_EXPIRED_IN_SEC,
    );

    return {
      accessToken: jwtAccess,
      refreshToken: jwtRefresh,
      result: { user, isNewUser },
      origin,
    };
  }

  // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

  /** authorization code → provider access token 교환 */
  private async exchangeCodeForToken(
    slug: SocialProviderSlug,
    cfg: ProviderConfig,
    code: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cfg.clientId as string,
      redirect_uri: this.resolveCallbackUrl(slug, cfg),
      code,
    });
    if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);

    const res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      this.logger.error(
        `[${slug}] 토큰 교환 실패: ${res.status} ${await res.text()}`,
      );
      throw new UnauthorizedException("소셜 인증에 실패했습니다.");
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new UnauthorizedException("소셜 인증에 실패했습니다.");
    }
    return json.access_token;
  }

  /** provider access token → 프로필 원본 조회 */
  private async fetchProfile(
    cfg: ProviderConfig,
    accessToken: string,
  ): Promise<unknown> {
    const res = await fetch(cfg.profileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      this.logger.error(`프로필 조회 실패: ${res.status} ${await res.text()}`);
      throw new UnauthorizedException("소셜 프로필 조회에 실패했습니다.");
    }
    return (await res.json()) as unknown;
  }

  /**
   * 정규화된 프로필로 SocialAccount + User 를 매핑한다.
   * 1) 이미 연결된 SocialAccount 가 있으면 그 유저로 로그인
   * 2) 같은 이메일의 기존 유저가 있으면 SocialAccount 만 연결(계정 통합)
   * 3) 둘 다 없으면 신규 유저 + SocialAccount 생성
   */
  private async upsertUser(profile: NormalizedSocialProfile) {
    const existing = await prisma.socialAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: { omit: { password: true } } },
    });
    if (existing) {
      return { user: existing.user, isNewUser: false };
    }

    // 이메일이 있으면 기존 유저와 연결 시도 (없으면 합성 이메일로 신규 생성).
    // TODO: 이메일 없는 계정 정책(중복/합성 이메일 규칙)을 서비스 요구사항에 맞게 확정할 것.
    const email =
      profile.email ??
      `${profile.provider.toLowerCase()}_${profile.providerAccountId}@social.local`;

    // job-033: 이메일이 플랫폼 전역 유니크이므로 테넌트와 무관하게 연결한다.
    const linkedUser = profile.email
      ? await prisma.user.findUnique({
          where: { email },
          omit: { password: true },
        })
      : null;

    if (linkedUser) {
      await prisma.socialAccount.create({
        data: {
          userId: linkedUser.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      });
      return { user: linkedUser, isNewUser: false };
    }

    const user = await prisma.user.create({
      data: {
        email,
        nickname: profile.nickname ?? "사용자",
        // 소셜 전용 계정은 password 가 없다(User.password 는 nullable).
        socialAccounts: {
          create: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      },
      omit: { password: true },
    });
    return { user, isNewUser: true };
  }

  // ── 리다이렉트 대상 (컨트롤러에서 사용) ──────────────────────────────────
  // 출발 앱에 따라 돌아갈 곳이 다르다. admin 에서 시작한 로그인을 web 으로 보내면
  // 매장 관리자가 보호자 화면에 떨어진다.
  private baseUrl(origin: SocialLoginOrigin): string {
    if (origin === "admin") {
      return (
        process.env.ADMIN_URL ??
        process.env.SOCIAL_LOGIN_ADMIN_REDIRECT ??
        "http://localhost:3333"
      );
    }
    return (
      env.SOCIAL_LOGIN_SUCCESS_REDIRECT ??
      process.env.WEB_URL ??
      "http://localhost:3001"
    );
  }

  /**
   * 로그인 성공 후 착지점.
   *
   * job-032: web 은 랜딩(`/`)이 아니라 로그인한 사람의 화면으로 바로 들어가야 한다.
   * job-042: 그 화면이 `/app` 으로 고정이 아니라 **소속에 따라 갈린다**(운영 중인 매장이
   * 하나면 그 매장으로 직행, 여럿이면 고르기, 없으면 개인 홈). 그 판단은 여기가 아니라
   * `/launch` 가 한다 — 매장 주소 규칙(`/tenant/<subdomain>/…`)은 web 의 것이고,
   * API 가 그것을 알고 조립하기 시작하면 경로가 바뀔 때마다 양쪽을 같이 고쳐야 한다.
   *
   * admin 은 플랫폼 콘솔 성격상 별도 대시보드 진입점이 없어 기존대로 루트로 보낸다.
   */
  successRedirect(origin: SocialLoginOrigin = "web") {
    const base = this.baseUrl(origin);
    return origin === "web" ? `${base}/launch` : base;
  }

  failureRedirect(origin: SocialLoginOrigin = "web") {
    return `${this.baseUrl(origin)}/auth/login?error=social`;
  }
}
