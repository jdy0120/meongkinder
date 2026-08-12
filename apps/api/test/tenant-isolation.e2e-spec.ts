import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { prismaConnect, prismaDisconnect } from "@pawlog/database";

import { ROLES } from "@pawlog/shared";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  asTenant,
  cleanupAll,
  grantMembership,
  openTenant,
  signupAndLogin,
  type SignedUpUser,
} from "./utils/tenant-setup";

// setupApplication 이 붙이는 글로벌 프리픽스: api/${PROJECT_NAME}
const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_AUTH = `${PREFIX}/v1/auth`;
const V1_PETS = `${PREFIX}/v1/pets`;
const V1_ATTENDANCES = `${PREFIX}/v1/attendances`;
const V1_DAILY_REPORTS = `${PREFIX}/v1/daily-reports`;
const V1_FILE = `${PREFIX}/v1/file`;
const V1_ADMIN = `${PREFIX}/v1/admin`;

type PetBody = { data: { pet: { id: string; name: string; userId: string } } };
type PetListBody = {
  data: { items: { id: string }[]; meta: { total: number } };
};
type AttendanceBody = { data: { attendance: { id: string; petId: string } } };
type AttendanceListBody = {
  data: { items: { id: string }[]; meta: { total: number } };
};
type ReportContentBody = { id: string; fileId: string | null };
type DailyReportBody = {
  data: { dailyReport: { id: string; contents: ReportContentBody[] } };
};
type DailyReportListBody = {
  data: { items: { id: string }[]; meta: { total: number } };
};
type ReportContentListBody = {
  data: { items: { id: string }[]; meta: { total: number } };
};
type UploadBody = { data: { id: string; originalName: string }[] };
type UserListBody = {
  data: { items: { id: string; email: string }[]; meta: { total: number } };
};
type MypageBody = { data: { user: { id: string } } };

describe("Tenant Isolation (e2e) — A 토큰으로 B 데이터 조회/수정/삭제 차단, 중첩 관계 누출 미노출, 파일 격리", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  const cleanup = cleanupAll;

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

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    await prismaDisconnect();

    // 실제 로컬 디스크에 이관된 사진 파일 정리 — resources/ 는 gitignore 대상이지만
    // 반복 실행 시 계속 누적되는 것을 막는다.
    rmSync(join(process.cwd(), "resources", "uploads", "daily-report"), {
      recursive: true,
      force: true,
    });
  });

  /**
   * job-033/034: 온보딩은 "회원가입 → 개설권 구독 → 온보딩" 순서가 됐다.
   * 개설자는 그 매장의 TENANT_ADMIN 멤버십을 자동으로 갖는다.
   */
  const onboardTenant = async (subdomain: string, adminEmail: string) => {
    const owner = await signupAndLogin(server(), {
      email: adminEmail,
      nickname: `${subdomain}-admin`,
    });
    const tenant = await openTenant(owner, {
      name: `${subdomain}-name`,
      subdomain,
    });
    return { tenant, owner };
  };

  /**
   * job-033: 가입은 테넌트와 무관하므로, 보호자는 가입 후 해당 테넌트의 ACTIVE 멤버십을 받아야 한다.
   * 그리고 JWT 에 tenantId 가 없어졌으므로 테넌트 스코프 호출은 asTenant 로 X-Tenant-Id 를 실어 보낸다.
   */
  const signupGuardian = async (
    tenantId: string,
    email: string,
    nickname: string,
  ) => {
    const user = await signupAndLogin(server(), { email, nickname });
    await grantMembership(user.userId, tenantId, ROLES.GUARDIAN);
    return user;
  };

  let tenantA: { id: string; subdomain: string };
  let tenantB: { id: string; subdomain: string };
  let adminA: ReturnType<typeof asTenant>;
  let adminB: ReturnType<typeof asTenant>;
  let ownerA: ReturnType<typeof asTenant>;
  let ownerB: ReturnType<typeof asTenant>;
  let ownerASession: SignedUpUser;

  // A 테넌트의 데이터 그래프: pet → attendance / dailyReport(+ reportContent, 사진 file)
  let petAId: string;
  let attendanceAId: string;
  let dailyReportAId: string;
  let reportContentAId: string;
  let fileAId: string;

  beforeAll(async () => {
    const a = await onboardTenant("iso-tenant-a", "iso-admin-a@example.com");
    const b = await onboardTenant("iso-tenant-b", "iso-admin-b@example.com");
    tenantA = a.tenant;
    tenantB = b.tenant;

    adminA = asTenant(a.owner.session, tenantA.id);
    adminB = asTenant(b.owner.session, tenantB.id);

    ownerASession = await signupGuardian(
      tenantA.id,
      "iso-owner-a@example.com",
      "iso-owner-a",
    );
    const ownerBSession = await signupGuardian(
      tenantB.id,
      "iso-owner-b@example.com",
      "iso-owner-b",
    );
    ownerA = asTenant(ownerASession.session, tenantA.id);
    ownerB = asTenant(ownerBSession.session, tenantB.id);

    // 펫은 회원 소유로 만들어진 뒤(tenantId=null) 등원으로 A 테넌트의 원생이 된다.
    const petRes = await ownerA
      .post(V1_PETS)
      .send({ name: "A테넌트펫", species: "DOG" })
      .expect(201);
    petAId = (petRes.body as PetBody).data.pet.id;

    await ownerA
      .post(`${V1_PETS}/${petAId}/enroll`)
      .send({ tenantId: tenantA.id })
      .expect(200);

    const attRes = await adminA
      .post(V1_ATTENDANCES)
      .send({ petId: petAId, date: "2026-07-30" })
      .expect(201);
    attendanceAId = (attRes.body as AttendanceBody).data.attendance.id;

    const uploadRes = await adminA
      .post(`${V1_FILE}/upload`)
      .attach("files", Buffer.from("tenant-a-secret-photo"), "a-photo.png")
      .expect(201);
    fileAId = (uploadRes.body as UploadBody).data[0].id;

    const reportRes = await adminA
      .post(V1_DAILY_REPORTS)
      .send({
        petId: petAId,
        date: "2026-07-30",
        summary: "A테넌트-비공개-코멘트",
        status: "PUBLISHED",
        contents: [
          { type: "PHOTO", fileId: fileAId, order: 0 },
          { type: "MEAL", content: "A테넌트 식사 기록", order: 1 },
        ],
      })
      .expect(201);
    const createdReport = (reportRes.body as DailyReportBody).data.dailyReport;
    dailyReportAId = createdReport.id;
    reportContentAId = createdReport.contents.find(
      (c) => c.fileId === fileAId,
    )!.id;
  });

  it("사전 조건: 두 테넌트가 서로 다른 id 로 생성되었다", () => {
    expect(tenantA.id).not.toBe(tenantB.id);
  });

  describe("Pet — owner API + admin API 양쪽에서 차단", () => {
    it("B owner 는 소유자 API(GET/PATCH/DELETE)로 A 펫에 접근할 수 없다 (404)", async () => {
      await ownerB.get(`${V1_PETS}/${petAId}`).expect(404);
      await ownerB
        .patch(`${V1_PETS}/${petAId}`)
        .send({ name: "가로채기" })
        .expect(404);
      await ownerB.delete(`${V1_PETS}/${petAId}`).expect(404);

      // A 입장에서는 B 의 시도로 영향받지 않고 여전히 정상 조회된다
      const res = await ownerA.get(`${V1_PETS}/${petAId}`).expect(200);
      expect((res.body as PetBody).data.pet.name).toBe("A테넌트펫");
    });

    it("B admin 은 전체 조회용 admin API(GET/PATCH)로도 A 펫에 접근할 수 없다 (404)", async () => {
      await adminB.get(`${V1_ADMIN}/pets/${petAId}`).expect(404);
      await adminB
        .patch(`${V1_ADMIN}/pets/${petAId}`)
        .send({ name: "가로채기" })
        .expect(404);
    });

    it("A admin 은 admin API 로 정상 조회된다 (동일 테넌트)", async () => {
      const res = await adminA.get(`${V1_ADMIN}/pets/${petAId}`).expect(200);
      expect((res.body as PetBody).data.pet.id).toBe(petAId);
    });

    it("B admin 의 admin 펫 목록에는 A 펫이 노출되지 않는다", async () => {
      const res = await adminB.get(`${V1_ADMIN}/pets`).expect(200);
      const items = (res.body as PetListBody).data.items;
      expect(items.some((p) => p.id === petAId)).toBe(false);
    });
  });

  describe("Attendance — STAFF/TENANT_ADMIN 전용 리소스도 테넌트로 격리된다", () => {
    it("B admin 은 A 출석 기록을 조회/등원처리/수정/삭제할 수 없다 (404)", async () => {
      await adminB.get(`${V1_ATTENDANCES}/${attendanceAId}`).expect(404);
      await adminB
        .post(`${V1_ATTENDANCES}/${attendanceAId}/check-in`)
        .send({})
        .expect(404);
      await adminB
        .patch(`${V1_ATTENDANCES}/${attendanceAId}`)
        .send({ status: "ABSENT" })
        .expect(404);
      await adminB.delete(`${V1_ATTENDANCES}/${attendanceAId}`).expect(404);
    });

    it("B admin 목록에는 A 출석 기록이 노출되지 않는다", async () => {
      const res = await adminB.get(V1_ATTENDANCES).expect(200);
      expect(
        (res.body as AttendanceListBody).data.items.some(
          (item) => item.id === attendanceAId,
        ),
      ).toBe(false);
    });

    it("A admin 이 B 테넌트 펫 id 를 참조해 출석을 생성하려 하면 404 (테넌트 간 참조 차단)", async () => {
      const petBRes = await ownerB
        .post(V1_PETS)
        .send({ name: "B테넌트펫", species: "CAT" })
        .expect(201);
      const petBId = (petBRes.body as PetBody).data.pet.id;

      await adminA
        .post(V1_ATTENDANCES)
        .send({ petId: petBId, date: "2026-07-30" })
        .expect(404);
    });

    it("A admin 은 여전히 정상적으로 자신의 출석 기록에 접근한다", async () => {
      const res = await adminA
        .get(`${V1_ATTENDANCES}/${attendanceAId}`)
        .expect(200);
      expect((res.body as AttendanceBody).data.attendance.id).toBe(
        attendanceAId,
      );
    });
  });

  describe("DailyReport + ReportContent — 상세/목록/중첩 항목 모두 미노출", () => {
    it("B admin 은 A 리포트 상세를 조회할 수 없다 (404) — 응답 어디에도 A 의 내용이 담기지 않는다", async () => {
      const res = await adminB.get(`${V1_DAILY_REPORTS}/${dailyReportAId}`);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("A테넌트-비공개-코멘트");
    });

    it("B admin 은 A 리포트를 수정/삭제할 수 없다 (404)", async () => {
      await adminB
        .patch(`${V1_DAILY_REPORTS}/${dailyReportAId}`)
        .send({ summary: "가로채기" })
        .expect(404);
      await adminB.delete(`${V1_DAILY_REPORTS}/${dailyReportAId}`).expect(404);
    });

    it("B admin 목록에는 A 리포트가 노출되지 않는다", async () => {
      const res = await adminB.get(V1_DAILY_REPORTS).expect(200);
      expect(
        (res.body as DailyReportListBody).data.items.some(
          (item) => item.id === dailyReportAId,
        ),
      ).toBe(false);
    });

    it("중첩 관계 누출 차단: B admin 이 A 리포트 id 로 하위 항목 목록을 조회해도 항목이 하나도 반환되지 않는다", async () => {
      const res = await adminB
        .get(`${V1_DAILY_REPORTS}/${dailyReportAId}/contents`)
        .expect(200);
      const body = (res.body as ReportContentListBody).data;
      expect(body.meta.total).toBe(0);
      expect(body.items).toHaveLength(0);
    });

    it("중첩 관계 누출 차단: B admin 은 A 리포트 항목 상세를 id 로 직접 조회할 수 없다 (404)", async () => {
      await adminB
        .get(
          `${V1_DAILY_REPORTS}/${dailyReportAId}/contents/${reportContentAId}`,
        )
        .expect(404);
      await adminB
        .patch(
          `${V1_DAILY_REPORTS}/${dailyReportAId}/contents/${reportContentAId}`,
        )
        .send({ content: "가로채기" })
        .expect(404);
      await adminB
        .delete(
          `${V1_DAILY_REPORTS}/${dailyReportAId}/contents/${reportContentAId}`,
        )
        .expect(404);
    });

    it("A admin 은 여전히 정상적으로 자신의 리포트와 항목에 접근한다", async () => {
      const res = await adminA
        .get(`${V1_DAILY_REPORTS}/${dailyReportAId}`)
        .expect(200);
      const body = (res.body as DailyReportBody).data.dailyReport;
      expect(body.id).toBe(dailyReportAId);
      expect(body.contents.some((c) => c.id === reportContentAId)).toBe(true);
    });
  });

  describe("File — 업로드/스트리밍 격리", () => {
    it("B admin 은 A 파일의 접근 URL 을 조회할 수 없다 (404)", async () => {
      await adminB.get(`${V1_FILE}/${fileAId}`).expect(404);
    });

    it("B admin 은 A 파일 원본 스트리밍(raw)에 접근할 수 없다 (404)", async () => {
      await adminB.get(`${V1_FILE}/${fileAId}/raw`).expect(404);
    });

    it("A admin 은 정상적으로 파일 원본 바이트를 스트리밍 받는다", async () => {
      const res = await adminA.get(`${V1_FILE}/${fileAId}/raw`).expect(200);
      expect(Buffer.from(res.body as Buffer).toString()).toBe(
        "tenant-a-secret-photo",
      );
    });
  });

  describe("Admin — 사용자 목록/역할변경도 테넌트로 격리된다", () => {
    it("B admin 의 사용자 목록에는 A 테넌트 사용자가 노출되지 않는다", async () => {
      const res = await adminB.get(`${V1_ADMIN}/users`).expect(200);
      const emails = (res.body as UserListBody).data.items.map((u) => u.email);
      expect(emails).not.toContain("iso-owner-a@example.com");
      expect(emails).not.toContain("iso-admin-a@example.com");
    });

    it("B admin 은 A 테넌트 사용자의 역할을 변경할 수 없다 (404)", async () => {
      const meRes = await ownerA.get(`${V1_AUTH}/mypage`).expect(200);
      const ownerAUserId = (meRes.body as MypageBody).data.user.id;

      await adminB
        .patch(`${V1_ADMIN}/users/${ownerAUserId}/role`)
        .send({ role: "STAFF" })
        .expect(404);
    });
  });
});
