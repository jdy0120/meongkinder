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

    await prisma.feedTag.deleteMany();
    await prisma.feedMedia.deleteMany();
    await prisma.feedPost.deleteMany();
    await prisma.reportContent.deleteMany();
    await prisma.dailyReport.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
    await prisma.file.deleteMany();
    await prisma.fileTemp.deleteMany();
  });

  afterAll(async () => {
    await prisma.feedTag.deleteMany();
    await prisma.feedMedia.deleteMany();
    await prisma.feedPost.deleteMany();
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

  /**
   * `DailyReport.authorId` 는 표기용이 아니라 **하루 마감이 사진을 덮어쓸지 가르는 근거**다
   * (`FeedDigestService.upsertReport` 의 `writtenByPerson`). 한동안 이 컬럼을 아무도 쓰지
   * 않아서 그 분기가 항상 거짓이었고, 재마감할 때마다 선생님이 직접 올린 사진이 피드 사진으로
   * 교체됐다 — 글 항목은 남고 사진만 바뀌므로 화면만 봐서는 알아채기 어렵다. 그래서 값이
   * 실제로 채워지는지를 테스트로 고정한다.
   */
  describe("작성자(authorId) — 하루 마감의 사진 덮어쓰기 판단 근거", () => {
    const feedGeneratedReport = async (petId: string, date: string) =>
      // 하루 마감이 만든 리포트를 흉내 낸다 — 작성자가 없는 것이 그 표식이다.
      prisma.dailyReport.create({
        data: {
          tenantId,
          petId,
          date: new Date(date),
          status: "DRAFT",
          aiCommentDraft: "오늘 친구들과 잘 지냈어요.",
        },
        select: { id: true },
      });

    it("사람이 작성한 리포트에는 작성자가 남는다", async () => {
      const { petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-author-owner@example.com",
        nickname: "dr-author-owner",
        petName: "작성자펫",
      });
      const admin = await newSignupAndLogin(server(), {
        email: "dr-author-admin@example.com",
        nickname: "dr-author-admin",
      });
      await grantMembership(admin.userId, tenantId, ROLES.TENANT_ADMIN);
      const adminSession = asTenant(admin.session, tenantId);

      const res = await adminSession
        .post(V1_DAILY_REPORTS)
        .send({ petId, date: "2026-07-31", status: "DRAFT" })
        .expect(201);

      const reportId = (res.body as DailyReportBody).data.dailyReport.id;
      const row = await prisma.dailyReport.findUnique({
        where: { id: reportId },
        select: { authorId: true },
      });
      expect(row?.authorId).toBe(admin.userId);
    });

    it("상태만 바꾸는 수정은 작성자를 남기지 않는다 (마감이 사진을 계속 갱신할 수 있어야 한다)", async () => {
      const { petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-publish-owner@example.com",
        nickname: "dr-publish-owner",
        petName: "발행펫",
      });
      const adminSession = await signupAndLoginAsAdmin(
        "dr-publish-admin@example.com",
        "dr-publish-admin",
      );
      const report = await feedGeneratedReport(petId, "2026-08-01");

      await adminSession
        .patch(`${V1_DAILY_REPORTS}/${report.id}`)
        .send({ status: "PUBLISHED" })
        .expect(200);

      const row = await prisma.dailyReport.findUnique({
        where: { id: report.id },
        select: { authorId: true, status: true },
      });
      expect(row?.status).toBe("PUBLISHED");
      expect(row?.authorId).toBeNull();
    });

    it("항목(contents)을 손댄 수정에는 작성자가 남는다", async () => {
      const { petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-edit-owner@example.com",
        nickname: "dr-edit-owner",
        petName: "수정펫",
      });
      const admin = await newSignupAndLogin(server(), {
        email: "dr-edit-admin@example.com",
        nickname: "dr-edit-admin",
      });
      await grantMembership(admin.userId, tenantId, ROLES.TENANT_ADMIN);
      const adminSession = asTenant(admin.session, tenantId);
      const report = await feedGeneratedReport(petId, "2026-08-02");

      await adminSession
        .patch(`${V1_DAILY_REPORTS}/${report.id}`)
        .send({
          contents: [{ type: "NOTE", content: "선생님이 직접 적은 특이사항" }],
        })
        .expect(200);

      const row = await prisma.dailyReport.findUnique({
        where: { id: report.id },
        select: { authorId: true },
      });
      expect(row?.authorId).toBe(admin.userId);
    });
  });

  /**
   * job-062: 알림장에 올린 사진은 피드에도 쌓인다.
   *
   * 입력구는 피드와 알림장 둘 다 남긴다 — 알림장은 "오늘 사진 안 올린 아이가 누구인지"를
   * 아이 단위로 보여주는 유일한 축이다. 없애는 것은 입력구가 아니라 **비대칭**이다:
   * 알림장에 올린 사진이 피드에 없어서 보호자 피드에도 안 뜨고 커버리지에도 안 잡히던 것.
   */
  describe("피드 미러 — 알림장 사진이 피드에도 쌓인다", () => {
    const uploadPhoto = async (
      session: ReturnType<typeof asTenant>,
      name: string,
    ) => {
      const res = await session
        .post(`${V1_FILE}/upload`)
        .attach("files", Buffer.from("fake-image-bytes"), name)
        .expect(201);
      return (res.body as UploadBody).data[0].id;
    };

    const mirrorOf = async (dailyReportId: string) =>
      prisma.feedPost.findFirst({
        where: { sourceDailyReportId: dailyReportId },
        select: {
          id: true,
          status: true,
          caption: true,
          media: { select: { fileId: true } },
          tags: { select: { petId: true, confirmed: true } },
        },
      });

    it("발행된 알림장의 사진이 그 아이로 태그된 피드 게시물이 된다", async () => {
      const { petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-mirror-owner@example.com",
        nickname: "dr-mirror-owner",
        petName: "미러펫",
      });
      const adminSession = await signupAndLoginAsAdmin(
        "dr-mirror-admin@example.com",
        "dr-mirror-admin",
      );
      const fileId = await uploadPhoto(adminSession, "mirror.png");

      const res = await adminSession
        .post(V1_DAILY_REPORTS)
        .send({
          petId,
          date: "2026-08-10",
          summary: "오늘 잘 놀았어요",
          status: "PUBLISHED",
          contents: [
            { type: "PHOTO", fileId, order: 0 },
            { type: "MEAL", content: "완식", order: 1 },
          ],
        })
        .expect(201);
      const reportId = (res.body as DailyReportBody).data.dailyReport.id;

      const mirror = await mirrorOf(reportId);
      expect(mirror).not.toBeNull();
      expect(mirror!.status).toBe("PUBLISHED");
      expect(mirror!.caption).toBe("오늘 잘 놀았어요");
      // 사진 항목만 올라간다 — MEAL 같은 글 항목은 피드에 올릴 것이 없다.
      expect(mirror!.media.map((m) => m.fileId)).toEqual([fileId]);
      expect(mirror!.tags).toEqual([{ petId, confirmed: true }]);
    });

    it("초안 알림장의 미러는 초안이라 보호자에게 새어 나가지 않는다", async () => {
      const { petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-mirror-draft-owner@example.com",
        nickname: "dr-mirror-draft-owner",
        petName: "초안미러펫",
      });
      const adminSession = await signupAndLoginAsAdmin(
        "dr-mirror-draft-admin@example.com",
        "dr-mirror-draft-admin",
      );
      const fileId = await uploadPhoto(adminSession, "draft.png");

      const res = await adminSession
        .post(V1_DAILY_REPORTS)
        .send({
          petId,
          date: "2026-08-11",
          status: "DRAFT",
          contents: [{ type: "PHOTO", fileId, order: 0 }],
        })
        .expect(201);
      const reportId = (res.body as DailyReportBody).data.dailyReport.id;

      expect((await mirrorOf(reportId))!.status).toBe("DRAFT");

      // 알림장을 발행하면 미러도 함께 발행된다.
      await adminSession
        .patch(`${V1_DAILY_REPORTS}/${reportId}`)
        .send({ status: "PUBLISHED" })
        .expect(200);
      expect((await mirrorOf(reportId))!.status).toBe("PUBLISHED");
    });

    it("알림장을 여러 번 고쳐도 미러 게시물은 하나다", async () => {
      const { petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-mirror-once-owner@example.com",
        nickname: "dr-mirror-once-owner",
        petName: "중복확인펫",
      });
      const adminSession = await signupAndLoginAsAdmin(
        "dr-mirror-once-admin@example.com",
        "dr-mirror-once-admin",
      );
      const first = await uploadPhoto(adminSession, "one.png");
      const second = await uploadPhoto(adminSession, "two.png");

      const res = await adminSession
        .post(V1_DAILY_REPORTS)
        .send({
          petId,
          date: "2026-08-12",
          status: "PUBLISHED",
          contents: [{ type: "PHOTO", fileId: first, order: 0 }],
        })
        .expect(201);
      const reportId = (res.body as DailyReportBody).data.dailyReport.id;

      // 알림장 수정은 항목을 통째로 갈아엎는다(`contents: { deleteMany: {} }`).
      // 연결 고리가 없으면 여기서 게시물이 하나씩 쌓인다.
      for (const fileId of [second, first]) {
        await adminSession
          .patch(`${V1_DAILY_REPORTS}/${reportId}`)
          .send({ contents: [{ type: "PHOTO", fileId, order: 0 }] })
          .expect(200);
      }

      const posts = await prisma.feedPost.findMany({
        where: { sourceDailyReportId: reportId },
        select: { id: true, media: { select: { fileId: true } } },
      });
      expect(posts).toHaveLength(1);
      // 마지막 저장 상태만 남는다.
      expect(posts[0].media.map((m) => m.fileId)).toEqual([first]);
    });

    it("사진을 모두 지우면 미러도 사라지고, 알림장을 지우면 함께 지워진다", async () => {
      const { petId } = await createGuardianWithPet(server(), tenantId, {
        email: "dr-mirror-gone-owner@example.com",
        nickname: "dr-mirror-gone-owner",
        petName: "삭제확인펫",
      });
      const adminSession = await signupAndLoginAsAdmin(
        "dr-mirror-gone-admin@example.com",
        "dr-mirror-gone-admin",
      );
      const fileId = await uploadPhoto(adminSession, "gone.png");

      const res = await adminSession
        .post(V1_DAILY_REPORTS)
        .send({
          petId,
          date: "2026-08-13",
          status: "PUBLISHED",
          contents: [{ type: "PHOTO", fileId, order: 0 }],
        })
        .expect(201);
      const reportId = (res.body as DailyReportBody).data.dailyReport.id;
      expect(await mirrorOf(reportId)).not.toBeNull();

      // 사진을 빼고 글만 남기면 피드에 올릴 것이 없다.
      await adminSession
        .patch(`${V1_DAILY_REPORTS}/${reportId}`)
        .send({ contents: [{ type: "NOTE", content: "사진 없이 기록만" }] })
        .expect(200);
      expect(await mirrorOf(reportId)).toBeNull();

      // 다시 넣었다가 알림장 자체를 지우면 FK CASCADE 로 미러도 함께 지워진다.
      await adminSession
        .patch(`${V1_DAILY_REPORTS}/${reportId}`)
        .send({ contents: [{ type: "PHOTO", fileId, order: 0 }] })
        .expect(200);
      expect(await mirrorOf(reportId)).not.toBeNull();

      await adminSession
        .delete(`${V1_DAILY_REPORTS}/${reportId}`)
        .expect(200);
      expect(await mirrorOf(reportId)).toBeNull();
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
