import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ROLES } from "@pawlog/shared";
import { prisma, prismaConnect, prismaDisconnect } from "@pawlog/database";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  asTenant,
  cleanupAll,
  createGuardianWithPet,
  grantMembership,
  openTenant,
  signupAndLogin as newSignupAndLogin,
} from "./utils/tenant-setup";

// setupApplication 이 붙이는 글로벌 프리픽스: api/${PROJECT_NAME}
const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_AUTH = `${PREFIX}/v1/auth`;
const V1_DAILY_REPORTS = `${PREFIX}/v1/daily-reports`;
const V1_FILE = `${PREFIX}/v1/file`;

const password = "password1234";

type UploadBody = { data: { id: string; originalName: string }[] };
type ReportContent = { type: string; fileId: string | null };
type DailyReportBody = {
  data: {
    dailyReport: {
      id: string;
      status: string;
      contents: ReportContent[];
    };
  };
};
type DailyReportListBody = {
  data: { items: { id: string; status: string }[]; meta: { total: number } };
};

describe("DailyReport (e2e) — 일일 리포트 생성 + 사진 첨부", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;
  let tenantId: string;

  beforeAll(async () => {
    // 안전 가드 — deleteMany 가 운영/개발 DB 를 지우는 사고 방지(방어 심화).
    if (!(process.env.DATABASE_URL ?? "").includes("template_test")) {
      throw new Error(
        "[e2e] DATABASE_URL 이 테스트 DB(template_test)가 아니라 중단합니다.",
      );
    }

    await prismaConnect();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApplication(app);
    await app.init();

    await cleanupAll();
    // 이 스펙이 사용할 매장 하나를 실제 온보딩 경로로 만든다(개설권 지급 포함).
    const tenantOwner = await newSignupAndLogin(server(), {
      email: "dr-tenant-owner@example.com",
      nickname: "dr-tenant-owner",
    });
    tenantId = (
      await openTenant(tenantOwner, {
        name: "dr-tenant",
        subdomain: "dr-tenant",
      })
    ).id;

    await prisma.reportContent.deleteMany();
    await prisma.dailyReport.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
    await prisma.file.deleteMany();
    await prisma.fileTemp.deleteMany();
  });

  afterAll(async () => {
    await prisma.reportContent.deleteMany();
    await prisma.dailyReport.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
    await prisma.file.deleteMany();
    await prisma.fileTemp.deleteMany();
    await app.close();
    await prismaDisconnect();

    // 실제 로컬 디스크에 이관된 사진 파일 정리 — resources/ 는 gitignore 대상이지만
    // 반복 실행 시 계속 누적되는 것을 막는다.
    rmSync(join(process.cwd(), "resources", "uploads", "daily-report"), {
      recursive: true,
      force: true,
    });
  });

  const signupAndLogin = async (email: string, nickname: string) => {
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

  /**
   * job-033: 테넌트 역할은 User.role 이 아니라 멤버십이 갖는다.
   * 가입 후 현재 스펙의 테넌트에 TENANT_ADMIN 멤버십을 부여하고,
   * 테넌트 스코프 호출이 되도록 X-Tenant-Id 를 실어 보내는 래퍼를 돌려준다.
   */
  const signupAndLoginAsAdmin = async (email: string, nickname: string) => {
    const user = await newSignupAndLogin(server(), { email, nickname });
    await grantMembership(user.userId, tenantId, ROLES.TENANT_ADMIN);
    return asTenant(user.session, tenantId);
  };

  describe("사진 첨부 리포트 생성 (ADMIN) → 보호자 열람", () => {
    it("사진 업로드 → PUBLISHED 리포트 생성 → 보호자가 mine 목록/상세로 조회 가능", async () => {
      const { owner, petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-owner@example.com",
        nickname: "dr-owner",
        petName: "리포트펫",
      });
      const ownerSession = owner.session;

      const adminSession = await signupAndLoginAsAdmin(
        "dr-admin@example.com",
        "dr-admin",
      );

      // 1. 사진 임시 업로드
      const uploadRes = await adminSession
        .post(`${V1_FILE}/upload`)
        .attach("files", Buffer.from("fake-image-bytes"), "photo.png")
        .expect(201);
      const uploadedFileId = (uploadRes.body as UploadBody).data[0].id;
      expect(uploadedFileId).toBeTruthy();

      // 2. 사진 항목을 포함한 일일 리포트를 PUBLISHED 상태로 생성
      const createRes = await adminSession
        .post(V1_DAILY_REPORTS)
        .send({
          petId,
          date: "2026-07-30",
          summary: "즐겁게 놀았어요",
          status: "PUBLISHED",
          contents: [
            { type: "PHOTO", fileId: uploadedFileId, order: 0 },
            { type: "MEAL", content: "사료 완식", order: 1 },
          ],
        })
        .expect(201);
      const created = (createRes.body as DailyReportBody).data.dailyReport;
      expect(created.status).toBe("PUBLISHED");
      const photoContent = created.contents.find((c) => c.type === "PHOTO");
      expect(photoContent?.fileId).toBe(uploadedFileId);

      // 3. 임시 업로드 파일이 영구 파일로 이관되고, 조회 가능한 URL 이 반환된다
      const fileUrlRes = await adminSession
        .get(`${V1_FILE}/${uploadedFileId}`)
        .expect(200);
      const fileUrlBody = (
        fileUrlRes.body as {
          data: { id: string; url: string; originalName: string };
        }
      ).data;
      expect(fileUrlBody.id).toBe(uploadedFileId);
      expect(fileUrlBody.originalName).toBe("photo.png");
      // job-024: `/resources` 정적 마운트 제거 → 인증된 스트리밍 엔드포인트(raw) URL 을 반환한다.
      expect(fileUrlBody.url).toContain(`${V1_FILE}/${uploadedFileId}/raw`);

      // 3-1. raw 스트리밍 엔드포인트는 인증 없이는 접근할 수 없다.
      await request(server())
        .get(`${V1_FILE}/${uploadedFileId}/raw`)
        .expect(401);

      // 3-2. 인증된 요청은 실제 파일 바이트를 스트리밍으로 돌려준다.
      const rawRes = await adminSession
        .get(`${V1_FILE}/${uploadedFileId}/raw`)
        .expect(200);
      expect(rawRes.headers["content-type"]).toContain("image/png");
      expect(Buffer.from(rawRes.body as Buffer).toString()).toBe(
        "fake-image-bytes",
      );

      // 4. 보호자(owner) 는 본인 소유 반려동물의 발행된 리포트를 mine 으로 열람 가능
      const mineListRes = await ownerSession
        .get(`${V1_DAILY_REPORTS}/mine`)
        .expect(200);
      const mineList = (mineListRes.body as DailyReportListBody).data;
      expect(mineList.meta.total).toBe(1);
      expect(mineList.items[0].id).toBe(created.id);

      const mineDetailRes = await ownerSession
        .get(`${V1_DAILY_REPORTS}/mine/${created.id}`)
        .expect(200);
      const mineDetail = (mineDetailRes.body as DailyReportBody).data
        .dailyReport;
      expect(mineDetail.contents.some((c) => c.fileId === uploadedFileId)).toBe(
        true,
      );
    });

    it("DRAFT 상태 리포트는 보호자 mine 목록에 노출되지 않는다", async () => {
      const { owner, petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-draft-owner@example.com",
        nickname: "dr-draft-owner",
        petName: "초안펫",
      });
      const ownerSession = owner.session;

      const adminSession = await signupAndLoginAsAdmin(
        "dr-draft-admin@example.com",
        "dr-draft-admin",
      );

      await adminSession
        .post(V1_DAILY_REPORTS)
        .send({ petId, date: "2026-07-30", status: "DRAFT" })
        .expect(201);

      const mineListRes = await ownerSession
        .get(`${V1_DAILY_REPORTS}/mine`)
        .expect(200);
      expect((mineListRes.body as DailyReportListBody).data.meta.total).toBe(0);
    });

    it("다른 보호자의 발행된 리포트는 mine 상세로 조회할 수 없다 (404)", async () => {
      const { petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-iso-a@example.com",
        nickname: "dr-iso-a",
        petName: "A소유펫",
      });
      const ownerBSession = await signupAndLogin(
        "dr-iso-b@example.com",
        "dr-iso-b",
      );

      const adminSession = await signupAndLoginAsAdmin(
        "dr-iso-admin@example.com",
        "dr-iso-admin",
      );
      const createRes = await adminSession
        .post(V1_DAILY_REPORTS)
        .send({ petId, date: "2026-07-30", status: "PUBLISHED" })
        .expect(201);
      const reportId = (createRes.body as DailyReportBody).data.dailyReport.id;

      await ownerBSession
        .get(`${V1_DAILY_REPORTS}/mine/${reportId}`)
        .expect(404);
    });
  });

  describe("접근 제어", () => {
    it("인증 없이 요청하면 401", async () => {
      await request(server()).get(V1_DAILY_REPORTS).expect(401);
    });

    it("USER 역할은 리포트 생성(ADMIN 전용)에서 403", async () => {
      const userSession = await signupAndLogin(
        "dr-user-role@example.com",
        "dr-user-role",
      );
      await userSession
        .post(V1_DAILY_REPORTS)
        .send({
          petId: "00000000-0000-0000-0000-000000000000",
          date: "2026-07-30",
        })
        .expect(403);
    });
  });
});
