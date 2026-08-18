/**
 * 개발용 이메일 + 비밀번호 로그인 노출 여부.
 *
 * `apps/web` 의 인증 경로는 카카오 하나다(job-036) — 이 상수가 그 결정을 뒤집지는 않는다.
 * 여는 이유는 로컬/개발에서 카카오가 **외부 의존**이기 때문이다: REST 키·리다이렉트 URI
 * 등록·실제 카카오 계정이 전부 갖춰져야 로그인이 되고, 그래서 신규 개발자나 QA 가
 * 시드 계정(`ADMIN_EMAIL`)으로 화면 하나 열어보는 것조차 막힌다.
 *
 * 서버 쪽은 아무것도 새로 열지 않는다. `POST v1/auth/login` 은 원래부터 `@Public()` 이고
 * (`apps/admin` + e2e 가 쓴다), 여기서 추가되는 건 그 엔드포인트로 가는 **화면**뿐이다.
 *
 * 켜지는 조건은 둘 중 하나:
 *   · `next dev` — `NODE_ENV !== "production"`. 로컬은 설정 없이 그냥 켜진다.
 *   · `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` — 빌드해서 띄우는 dev 배포용 명시적 opt-in.
 *
 * 두 값 모두 Next 가 빌드 시점에 리터럴로 인라인하므로 운영 빌드에서는 `false` 로 접히고
 * 폼이 렌더되지 않는다(런타임에 켤 수 있는 스위치가 아니다).
 * ⚠️ 운영 환경에 `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` 를 넣지 말 것.
 */
export const IS_DEV_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";
