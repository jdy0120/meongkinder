import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { User } from "@pawlog/database";

import { prismaMock, resetPrismaMock } from "../../../test/utils/prisma.mock";

// 서비스가 직접 import 하는 전역 싱글턴 prisma 를 목으로 대체.
// require 는 factory 지연 평가를 위해 필요(import 는 hoisting 되어 TDZ 문제 발생).
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("@pawlog/database", () =>
  (
    require("../../../test/utils/prisma.mock") as typeof import("../../../test/utils/prisma.mock")
  ).createDatabaseMock(),
);
/* eslint-enable @typescript-eslint/no-require-imports */

import { AuthService } from "./auth.service";
import type { RedisService } from "../../shared/redis/redis.service";
import type { MailerService } from "@nestjs-modules/mailer";
import type { InvitationService } from "../../membership/services/invitation.service";

type RedisMock = {
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
};

type MailerMock = { sendMail: jest.Mock };
// job-034: 가입 직후 대기 중인 초대를 소속 처리한다. 유닛 테스트에서는 "매칭된 초대 없음"으로 둔다.
type InvitationMock = { claimForUser: jest.Mock };

const asUser = (u: Partial<User>): User => u as unknown as User;

describe("AuthService", () => {
  let service: AuthService;
  let redis: RedisMock;
  let mailer: MailerMock;
  let invitations: InvitationMock;

  beforeEach(() => {
    resetPrismaMock();
    redis = { set: jest.fn(), get: jest.fn(), del: jest.fn() };
    mailer = { sendMail: jest.fn() };
    invitations = { claimForUser: jest.fn().mockResolvedValue([]) };
    service = new AuthService(
      redis as unknown as RedisService,
      mailer as unknown as MailerService,
      invitations as unknown as InvitationService,
    );
  });

  describe("signup", () => {
    it("이미 가입된 이메일이면 ConflictException", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        asUser({ id: "u1", email: "dup@example.com" }),
      );

      await expect(
        service.signup({
          email: "dup@example.com",
          password: "password1234",
          nickname: "dup",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("활성 필수 약관에 미동의하면 BadRequestException", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.terms.findMany.mockResolvedValue([
        {
          id: "t1",
          title: "서비스 이용약관",
          isActive: true,
          isRequired: true,
        },
      ] as never);

      await expect(
        service.signup({
          email: "new@example.com",
          password: "password1234",
          nickname: "new",
          agreements: [], // 필수 약관 동의 없음
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // job-033: 회원가입은 어떤 테넌트에도 속하지 않는 전역 계정을 만든다.
    // (예전에는 서브도메인/헤더로 테넌트를 찾고, 없으면 default-tenant 로 폴백했다)
    it("테넌트에 속하지 않는 회원을 만들고 약관 동의를 함께 저장한다", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.terms.findMany.mockResolvedValue([] as never);
      // 인터랙티브 트랜잭션 목 — 콜백에 목 클라이언트를 그대로 넘겨 실행한다.
      // 오버로드가 여러 개라 시그니처를 좁히기 어려워 호출부에서만 캐스팅한다.
      (prismaMock.$transaction as unknown as jest.Mock).mockImplementation(
        (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
      );
      prismaMock.user.create.mockResolvedValue(
        asUser({ id: "u-new", email: "new@example.com", role: "USER" }),
      );

      const result = await service.signup({
        email: "new@example.com",
        password: "password1234",
        nickname: "new",
        agreements: [{ termsId: "t1", isAgreed: true }],
      });

      expect(result.user.id).toBe("u-new");

      // 생성 데이터에 tenantId 가 실리면 안 된다.
      const createArg = prismaMock.user.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(createArg.data).not.toHaveProperty("tenantId");
      expect(createArg.data.email).toBe("new@example.com");

      // 약관 동의도 테넌트에 매이지 않는다.
      const agreementArg = prismaMock.userTermsAgreement.createMany.mock
        .calls[0]?.[0] as { data: Record<string, unknown>[] };
      expect(agreementArg.data[0]).not.toHaveProperty("tenantId");
      expect(agreementArg.data[0].userId).toBe("u-new");
    });
  });

  describe("login", () => {
    it("사용자가 없으면 UnauthorizedException", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "none@example.com", password: "password1234" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("비밀번호가 틀리면 UnauthorizedException", async () => {
      const hashed = await bcrypt.hash("correct-password", 10);
      prismaMock.user.findUnique.mockResolvedValue(
        asUser({
          id: "u1",
          email: "user@example.com",
          password: hashed,
          role: "USER",
        }),
      );

      await expect(
        service.login({ email: "user@example.com", password: "wrong-pass" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("성공 시 토큰을 발급하고 refresh 를 Redis 에 저장", async () => {
      const hashed = await bcrypt.hash("password1234", 10);
      prismaMock.user.findUnique.mockResolvedValue(
        asUser({
          id: "u1",
          email: "user@example.com",
          password: hashed,
          role: "USER",
        }),
      );

      const result = await service.login({
        email: "user@example.com",
        password: "password1234",
      });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(redis.set).toHaveBeenCalledWith(
        "refresh:u1",
        result.refreshToken,
        expect.any(Number),
      );
    });

    // job-033: 한 회원이 여러 테넌트에 속할 수 있어 토큰이 테넌트를 지목할 수 없다.
    // 활성 테넌트는 요청마다 서브도메인/X-Tenant-Id 로 정해지고 미들웨어가 멤버십을 검증한다.
    it("액세스 토큰에 tenantId 클레임을 담지 않는다", async () => {
      const hashed = await bcrypt.hash("password1234", 10);
      prismaMock.user.findUnique.mockResolvedValue(
        asUser({
          id: "u1",
          email: "user@example.com",
          password: hashed,
          role: "USER",
        }),
      );

      const { accessToken } = await service.login({
        email: "user@example.com",
        password: "password1234",
      });

      const claims = jwt.decode(accessToken) as Record<string, unknown>;
      expect(claims).not.toHaveProperty("tenantId");
      expect(claims.userId).toBe("u1");
      expect(claims.role).toBe("USER");
    });
  });

  describe("refresh", () => {
    it("Redis 저장 값과 다르면 UnauthorizedException", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        asUser({ id: "u1", email: "user@example.com", role: "USER" }),
      );
      redis.get.mockResolvedValue("saved-token");

      await expect(
        service.refresh({
          email: "user@example.com",
          refreshToken: "different-token",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("일치하면 새 토큰을 발급하고 refresh 를 회전(재저장)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        asUser({ id: "u1", email: "user@example.com", role: "USER" }),
      );
      redis.get.mockResolvedValue("old-refresh-token");

      const result = await service.refresh({
        email: "user@example.com",
        refreshToken: "old-refresh-token",
      });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      // 회전: 새 refresh 토큰으로 재저장
      expect(redis.set).toHaveBeenCalledWith(
        "refresh:u1",
        result.refreshToken,
        expect.any(Number),
      );
    });
  });

  describe("forgotPassword", () => {
    it("존재하는 이메일이면 리셋 토큰을 저장하고 메일을 보낸다", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        asUser({ id: "u1", email: "user@example.com" }),
      );

      const result = await service.forgotPassword({
        email: "user@example.com",
      });

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^reset:/),
        "u1",
        expect.any(Number),
      );
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it("존재하지 않는 이메일이어도 동일 메시지를 반환한다(계정 열거 방지)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: "none@example.com",
      });

      expect(redis.set).not.toHaveBeenCalled();
      expect(mailer.sendMail).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("resetPassword", () => {
    it("유효하지 않은 토큰이면 BadRequestException", async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: "bad", password: "newpassword1234" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("유효한 토큰이면 비밀번호를 갱신하고 토큰·세션을 무효화한다", async () => {
      redis.get.mockResolvedValue("u1");

      const result = await service.resetPassword({
        token: "good-token",
        password: "newpassword1234",
      });

      // deep 목 메서드 참조 + expect.any 는 unbound-method/unsafe-assignment false positive
      /* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { password: expect.any(String) },
      });
      /* eslint-enable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
      expect(redis.del).toHaveBeenCalledWith("reset:good-token");
      expect(redis.del).toHaveBeenCalledWith("refresh:u1");
      expect(result).toBeNull();
    });
  });
});
