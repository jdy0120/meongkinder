import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, prismaConnect, prismaDisconnect } from "@pawlog/database";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  openTenant,
  signupAndLogin as newSignupAndLogin,
} from "./utils/tenant-setup";

// setupApplication 이 붙이는 글로벌 프리픽스: api/${PROJECT_NAME}
const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_AUTH = `${PREFIX}/v1/auth`;
const V1_ADMIN = `${PREFIX}/v1/admin`;

const password = "password1234";

/** TransformInterceptor 가 감싸는 응답 형태 */
type ApiBody = {
  result: boolean;
  message: string;
  data: { user: { email: string; role: string } };
};

describe("Auth (e2e)", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    // 안전 가드 — deleteMany 가 운영/개발 DB 를 지우는 사고 방지(방어 심화).
    if (!(process.env.DATABASE_URL ?? "").includes("template_test")) {
      throw new Error(
        "[e2e] DATABASE_URL 이 테스트 DB(template_test)가 아니라 중단합니다.",
      );
    }

    // AppModule 은 자동으로 prisma 를 연결하지 않는다(main.ts 가 함). 직접 연결.
    await prismaConnect();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApplication(app); // 프리픽스·쿠키파서·ValidationPipe·인터셉터·필터 적용
    await app.init();

    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
    await prismaDisconnect();
  });

  describe("signup → login → 보호 라우트 → refresh → logout", () => {
    const email = "flow@example.com";
    let session: ReturnType<typeof request.agent>;

    beforeAll(() => {
      session = request.agent(server());
    });

    it("signup: 공개 라우트, 201", async () => {
      const res = await session
        .post(`${V1_AUTH}/signup`)
        .send({ email, password, nickname: "flow" })
        .expect(201);

      const body = res.body as ApiBody;
      expect(body.result).toBe(true);
      expect(body.data.user.email).toBe(email);
    });

    it("login: 200 + httpOnly 쿠키 발급", async () => {
      const res = await session
        .post(`${V1_AUTH}/login`)
        .send({ email, password })
        .expect(200);

      const cookies = (res.headers["set-cookie"] ?? []) as string[];
      expect(cookies.join(";")).toContain("access_token");
      expect(cookies.join(";")).toContain("refresh_token");
    });

    it("mypage: 쿠키로 인증된 요청은 200", async () => {
      const res = await session.get(`${V1_AUTH}/mypage`).expect(200);
      expect((res.body as ApiBody).data.user.email).toBe(email);
    });

    it("refresh: refresh 쿠키로 토큰 재발급 200", async () => {
      await session.post(`${V1_AUTH}/refresh`).expect(200);
    });

    it("logout: 200", async () => {
      await session.post(`${V1_AUTH}/logout`).expect(200);
    });
  });

  describe("인증/인가 가드", () => {
    it("mypage: 토큰 없으면 401", async () => {
      await request(server()).get(`${V1_AUTH}/mypage`).expect(401);
    });

    it("admin: USER 역할은 403 (RolesGuard)", async () => {
      const email = "user-role@example.com";
      const session = request.agent(server());
      await session
        .post(`${V1_AUTH}/signup`)
        .send({ email, password, nickname: "user" })
        .expect(201);
      await session
        .post(`${V1_AUTH}/login`)
        .send({ email, password })
        .expect(200);

      await session.get(`${V1_ADMIN}/me`).expect(403);
    });

    /**
     * job-033: 테넌트 역할은 User.role 이 아니라 TenantMembership 이 갖는다.
     * 따라서 관리자 라우트를 통과하려면 (1) 매장의 TENANT_ADMIN 멤버십과
     * (2) 활성 테넌트 지정(X-Tenant-Id)이 모두 필요하다.
     */
    it("admin: 활성 테넌트의 TENANT_ADMIN 멤버십이 있으면 200", async () => {
      const owner = await newSignupAndLogin(server(), {
        email: "admin-role@example.com",
        nickname: "admin",
      });
      const tenant = await openTenant(owner, {
        name: "auth-admin-tenant",
        subdomain: "auth-admin",
      });

      await owner.session
        .get(`${V1_ADMIN}/me`)
        .set("X-Tenant-Id", tenant.id)
        .expect(200);
    });

    it("admin: 멤버십이 있어도 활성 테넌트를 지정하지 않으면 403 (개인 스코프)", async () => {
      const owner = await newSignupAndLogin(server(), {
        email: "admin-no-ctx@example.com",
        nickname: "admin2",
      });
      await openTenant(owner, {
        name: "auth-noctx-tenant",
        subdomain: "auth-noctx",
      });

      await owner.session.get(`${V1_ADMIN}/me`).expect(403);
    });
  });

  /**
   * 전화번호는 이 서비스에서 **매칭 키**다 — 매장이 번호로 등록해 둔 아이가 가입하는
   * 사람에게 `claimForUser` 로 넘어간다. 같은 번호를 두 계정이 들고 있으면 그 소유권이
   * 정해지지 않고, `PetIntakeService` 는 아이를 임의로 넘기지 않으려 409 로 멈춘다
   * (= 원장이 번호를 아는데도 **원생 조회가 통째로 막힌다**). 그래서 들어올 때 막는다.
   *
   * ⚠️ 이 검사는 문자 발송 **전**에 돈다. 그래서 Solapi 가 설정되지 않은 테스트 환경에서도
   * 503 이 아니라 409 가 나온다 — 발송 뒤에 막았다면 이 스펙 자체를 쓸 수 없었고, 실제
   * 사용자도 인증번호를 다 입력한 뒤에야 "쓸 수 없는 번호"라는 말을 들었을 것이다.
   */
  describe("휴대폰 인증 — 이미 등록된 번호는 발송 전에 막힌다", () => {
    // ⚠️ 테스트마다 다른 번호를 쓴다. 이 스펙은 케이스 사이에 유저를 지우지 않으므로
    // 같은 번호를 재사용하면 앞 테스트가 남긴 계정 때문에 "본인 번호"까지 중복으로 잡힌다.
    const phone = "01055556666";
    const phone2 = "01055557777";
    const selfPhone = "01055558888";

    const login = async (email: string, nickname: string) => {
      const session = request.agent(server());
      await session
        .post(`${V1_AUTH}/signup`)
        .send({ email, password, nickname })
        .expect(201);
      await session
        .post(`${V1_AUTH}/login`)
        .send({ email, password })
        .expect(200);
      return session;
    };

    it("다른 계정이 쓰는 번호로 인증을 요청하면 409", async () => {
      const ownerSession = await login("otp-owner@example.com", "otp-owner");
      const me = await ownerSession.get(`${V1_AUTH}/mypage`).expect(200);
      const ownerId = (me.body as { data: { user: { id: string } } }).data.user
        .id;
      await prisma.user.update({ where: { id: ownerId }, data: { phone } });

      const otherSession = await login("otp-other@example.com", "otp-other");
      const res = await otherSession
        .post(`${V1_AUTH}/phone/otp`)
        .send({ phone })
        .expect(409);

      expect((res.body as { message: string }).message).toContain(
        "이미 다른 계정에 등록된",
      );
    });

    it("하이픈을 넣어 보내도 같은 번호로 보고 막는다", async () => {
      const ownerSession = await login("otp-owner2@example.com", "otp-owner2");
      const me = await ownerSession.get(`${V1_AUTH}/mypage`).expect(200);
      const ownerId = (me.body as { data: { user: { id: string } } }).data.user
        .id;
      await prisma.user.update({
        where: { id: ownerId },
        data: { phone: phone2 },
      });

      const otherSession = await login("otp-other2@example.com", "otp-other2");
      await otherSession
        .post(`${V1_AUTH}/phone/otp`)
        .send({ phone: "010-5555-7777" })
        .expect(409);
    });

    it("본인이 이미 등록한 번호는 막지 않는다 (재인증은 정상 흐름)", async () => {
      const session = await login("otp-self@example.com", "otp-self");
      const me = await session.get(`${V1_AUTH}/mypage`).expect(200);
      const userId = (me.body as { data: { user: { id: string } } }).data.user
        .id;
      await prisma.user.update({
        where: { id: userId },
        data: { phone: selfPhone },
      });

      // 중복이 아니므로 409 를 지나 발송 단계까지 간다. 이 환경엔 Solapi 가 없어 503 이고,
      // 그것이 곧 "중복 검사를 통과했다"는 증거다.
      await session
        .post(`${V1_AUTH}/phone/otp`)
        .send({ phone: selfPhone })
        .expect(503);
    });
  });

  /**
   * 내 정보 수정에서 번호를 **바꿀 때만** 본인확인을 요구한다.
   *
   * 폼은 번호 칸을 늘 함께 보내므로, 값이 같아도 검사하면 **닉네임만 고치는 저장까지
   * 전부 400 이 된다** — 화면은 저장 버튼이 눌리는데 서버만 거절하니 사용자는 이유를
   * 알 수 없다. 실제로 그 상태였고, 이 스펙이 그 회귀를 막는다.
   */
  describe("내 정보 수정 — 번호가 바뀔 때만 본인확인", () => {
    const login = async (email: string, nickname: string) => {
      const session = request.agent(server());
      await session
        .post(`${V1_AUTH}/signup`)
        .send({ email, password, nickname })
        .expect(201);
      await session
        .post(`${V1_AUTH}/login`)
        .send({ email, password })
        .expect(200);
      return session;
    };
    const myId = async (session: request.Agent) => {
      const res = await session.get(`${V1_AUTH}/mypage`).expect(200);
      return (res.body as { data: { user: { id: string } } }).data.user.id;
    };

    it("번호를 그대로 둔 채 닉네임만 바꾸면 본인확인 없이 저장된다", async () => {
      const session = await login("prof-nick@example.com", "prof-nick");
      const userId = await myId(session);
      await prisma.user.update({
        where: { id: userId },
        data: { phone: "01077770001" },
      });

      const res = await session
        .patch(`${V1_AUTH}/me`)
        .send({ nickname: "바뀐닉네임", phone: "01077770001" })
        .expect(200);

      expect(
        (res.body as { data: { user: { nickname: string } } }).data.user
          .nickname,
      ).toBe("바뀐닉네임");
    });

    it("하이픈 표기로 보내도 같은 번호로 보고 통과시킨다", async () => {
      const session = await login("prof-hyphen@example.com", "prof-hyphen");
      const userId = await myId(session);
      await prisma.user.update({
        where: { id: userId },
        data: { phone: "01077770002" },
      });

      await session
        .patch(`${V1_AUTH}/me`)
        .send({ nickname: "표기무관", phone: "010-7777-0002" })
        .expect(200);
    });

    it("번호를 바꾸려면 본인확인이 필요하다 (400)", async () => {
      const session = await login("prof-change@example.com", "prof-change");
      const userId = await myId(session);
      await prisma.user.update({
        where: { id: userId },
        data: { phone: "01077770003" },
      });

      const res = await session
        .patch(`${V1_AUTH}/me`)
        .send({ phone: "01077779999" })
        .expect(400);

      expect((res.body as { message: string }).message).toContain(
        "본인확인이 필요합니다",
      );

      // 거절된 요청의 번호가 저장되지 않아야 한다.
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { phone: true },
      });
      expect(after.phone).toBe("01077770003");
    });

    it("번호가 없던 사람이 번호를 넣을 때도 본인확인이 필요하다 (400)", async () => {
      const session = await login("prof-first@example.com", "prof-first");

      await session
        .patch(`${V1_AUTH}/me`)
        .send({ phone: "01077770004" })
        .expect(400);
    });
  });
});
