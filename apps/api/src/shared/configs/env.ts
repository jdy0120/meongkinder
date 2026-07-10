import { z } from "zod";

/**
 * 환경변수 중앙 검증.
 *
 * - main.ts 최상단에서 side-effect 로 import 되어, 그 어떤 모듈보다 먼저 실행됩니다.
 * - token.ts 등 시크릿을 쓰는 모듈도 이 파일을 import 하므로, 검증 통과 전에는
 *   시크릿 상수가 절대 평가되지 않습니다(약한 폴백 값 주입 원천 차단).
 * - 문제가 있으면 모든 오류를 한 번에 출력하고 process.exit(1) 로 즉시 종료(fail-fast).
 */

// "30*60" 같은 문자열 수식(convention)과 "1800" 같은 정수 문자열을 모두 지원한다.
// 파싱 불가한 값은 그대로 통과시켜 zod 가 명확한 타입 에러를 내도록 둔다.
const durationSeconds = (fallback: number) =>
  z.preprocess((raw) => {
    if (raw === undefined || raw === "") return fallback;
    // 문자열/숫자만 처리하고, 그 외 타입은 그대로 통과시켜 zod 가 타입 에러를 내게 한다.
    if (typeof raw !== "string" && typeof raw !== "number") return raw;
    const factors = String(raw)
      .split("*")
      .map((part) => Number(part.trim()));
    if (factors.some((n) => !Number.isFinite(n))) return raw;
    return factors.reduce((acc, n) => acc * n, 1);
  }, z.number().int().positive());

const schema = z.object({
  // 🔴 시크릿: 폴백 금지 + 최소 길이 강제. 약한 기본값("jwt-access-secret" 등) 자체를 차단.
  //    운영에서는 `openssl rand -hex 32`(=64자) 로 발급하세요.
  ACCESS_JWT_SECRET: z
    .string()
    .min(32, "ACCESS_JWT_SECRET must be at least 32 characters"),
  REFRESH_JWT_SECRET: z
    .string()
    .min(32, "REFRESH_JWT_SECRET must be at least 32 characters"),
  SIGN_UP_JWT_SECRET: z
    .string()
    .min(32, "SIGN_UP_JWT_SECRET must be at least 32 characters"),

  // 🟢 만료 시간: 기본값 허용. "30*60" / "1800" 모두 파싱.
  ACCESS_JWT_EXPIRED_SEC: durationSeconds(30 * 60),
  REFRESH_JWT_EXPIRED_SEC: durationSeconds(3 * 24 * 60 * 60),
  SIGN_UP_JWT_EXPIRED_SEC: durationSeconds(30 * 60),

  // 🔴 데이터베이스: 필수. postgres 연결 문자열이어야 함.
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((value) => /^postgres(ql)?:\/\//.test(value), {
      message: "DATABASE_URL must be a postgres connection string",
    }),

  // 🟠 Redis: auth 토큰/OTP 저장소(필수 인프라). 로컬 기본값 허용, 도커에선 compose 가 주입.
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // 🟢 소셜 로그인(선택): 값이 없으면 해당 provider 엔드포인트가 501(미설정) 을 반환한다.
  //    개발자 콘솔에서 앱 생성 → Redirect URI 등록 → Client ID/Secret 발급 후 채운다.
  //    Callback URL 미지정 시 `${API_PUBLIC_URL}/api/${PROJECT_NAME}/v1/auth/{provider}/callback` 로 조립.
  API_PUBLIC_URL: z.string().optional(), // 브라우저에서 접근 가능한 API 주소 (콜백 조립용)
  SOCIAL_LOGIN_SUCCESS_REDIRECT: z.string().optional(), // 로그인 성공 후 web 랜딩 (미지정 시 WEB_URL)
  SOCIAL_LOGIN_FAILURE_REDIRECT: z.string().optional(), // 로그인 실패 후 web 랜딩 (미지정 시 WEB_URL/auth/login)

  KAKAO_CLIENT_ID: z.string().optional(),
  KAKAO_CLIENT_SECRET: z.string().optional(), // 카카오는 시크릿이 선택(콘솔에서 사용 설정 시)
  KAKAO_CALLBACK_URL: z.string().optional(),

  NAVER_CLIENT_ID: z.string().optional(),
  NAVER_CLIENT_SECRET: z.string().optional(),
  NAVER_CALLBACK_URL: z.string().optional(),

  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_CALLBACK_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  // Nest 로거 초기화 이전 시점이므로 console 을 직접 사용한다.

  console.error(`\n❌ 환경변수 검증 실패:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
