import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { prisma, prismaConnect } from "@pawlog/database";
import { ROLES, type BusinessHours } from "@pawlog/shared";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  asTenant,
  cleanupAll,
  createGuardianWithPet,
  grantMembership,
  openTenant,
  prefix,
  signupAndLogin,
  type SignedUpUser,
} from "./utils/tenant-setup";

/**
 * 매장 운영시간 · 임시 휴무 e2e (job-060).
 *
 * 설계 근거는 `docs/business-hours-and-reservations.md`. 여기서 지키는 것은 그 문서의
 * MUST 중 셸 스모크로만 확인하던 것들이다:
 *
 *   · 운영시간 `null` 은 "미등록"이지 "매일 휴무"가 아니다 (§2.1)
 *   · 저장 경로가 `validateBusinessHours` + `normalizeBusinessHours` 를 반드시 거친다 (§7-1)
 *   · 휴무 지정이 그 날 예약을 **한 트랜잭션으로** 푼다 (§3.1)
 *   · 통보 대상은 삭제된 행이 아니라 `scheduledOn` 전체다 — WEEKLY 정기 등원 아이 포함 (§7-7)
 *
 * ⚠️ 마지막 항목이 이 스펙의 핵심이다. 삭제된 `PetSchedule` 행만 세는 구현으로 되돌아가면
 * 매주 그 요일에 오는 아이들이 통보에서 통째로 빠지는데, 그 실패는 아이가 문 닫은 매장
 * 앞에 나타나서야 드러난다. 코드만 봐서는 멀쩡해 보이므로 테스트로 못 박는다.
 */

const V1_TENANTS = () => `${prefix()}/v1/tenants`;

/** 요일 무관하게 열려 있는 시간표. 날짜 판정을 요일에서 떼어내 테스트를 안정시킨다. */
const openEveryDay = (): BusinessHours => ({
  days: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    closed: false,
    open: "09:00",
    close: "19:00",
    breaks: [],
  })),
  closedOnPublicHolidays: false,
  note: null,
});

/** `Date` → `"YYYY-MM-DD"` (로컬). `toISOString` 은 UTC 라 KST 에서 하루 밀린다. */
const toKey = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

/** 오늘로부터 n일 뒤. 예약/휴무는 미래여야 해서 상대 날짜로만 만든다. */
const daysFromNow = (n: number): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return date;
};

describe("Business hours & closures (e2e) — 매장 운영시간 · 임시 휴무 (job-060)", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  let owner: SignedUpUser;
  let tenantId: string;

  beforeAll(async () => {
    // 안전 가드 — deleteMany 가 운영/개발 DB 를 지우는 사고 방지.
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

    owner = await signupAndLogin(server(), {
      email: "owner@hours.test",
      nickname: "원장",
    });
    const tenant = await openTenant(owner, {
      name: "운영시간 유치원",
      subdomain: "hourstest",
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await cleanupAll();
    await app.close();
  });

  // ── 운영시간 ────────────────────────────────────────────────────────────

  describe("운영시간 저장·조회", () => {
    it("등록 전에는 null 이다 — '미등록'이지 '매일 휴무'가 아니다", async () => {
      const res = await asTenant(owner.session, tenantId)
        .get(`${V1_TENANTS()}/settings`)
        .expect(200);

      const body = res.body as {
        data: { tenant: { businessHours: BusinessHours | null } };
      };
      // ⚠️ 여기서 기본값을 채워 내리면 매장이 **말한 적 없는 시간**을 우리가 지어내
      // 보호자에게 보여주게 된다 (§2.1).
      expect(body.data.tenant.businessHours).toBeNull();
    });

    it("저장하면 7요일이 0~6 순서로 채워져 돌아온다 (정규화)", async () => {
      // 일부러 3일치만, 순서도 섞어서 보낸다.
      const partial: BusinessHours = {
        days: [
          { day: 3, closed: false, open: "10:00", close: "20:00", breaks: [] },
          { day: 1, closed: false, open: "09:00", close: "19:00", breaks: [] },
          { day: 0, closed: true, open: "09:00", close: "19:00", breaks: [] },
        ],
        closedOnPublicHolidays: true,
        note: "  마지막 등원 17:00까지  ",
      };

      const res = await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: partial })
        .expect(200);

      const hours = (
        res.body as { data: { tenant: { businessHours: BusinessHours } } }
      ).data.tenant.businessHours;

      expect(hours.days).toHaveLength(7);
      expect(hours.days.map((day) => day.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      // 보내지 않은 요일은 휴무로 채워진다 — 조용히 영업으로 만들면 안 된다.
      expect(hours.days[2].closed).toBe(true);
      expect(hours.days[3].open).toBe("10:00");
      // note 는 trim 되고, 빈 문자열이면 null 이 된다.
      expect(hours.note).toBe("마지막 등원 17:00까지");
    });

    it("휴무 요일에 남은 휴게시간은 버린다 — 요일을 다시 켰을 때 되살아나면 안 된다", async () => {
      const res = await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({
          businessHours: {
            days: [
              {
                day: 2,
                closed: true,
                open: "09:00",
                close: "19:00",
                breaks: [{ start: "12:00", end: "13:00" }],
              },
            ],
            closedOnPublicHolidays: false,
            note: null,
          },
        })
        .expect(200);

      const hours = (
        res.body as { data: { tenant: { businessHours: BusinessHours } } }
      ).data.tenant.businessHours;
      expect(hours.days[2].breaks).toEqual([]);
    });

    it("자정을 넘긴 영업(20:00~02:00)을 그대로 저장한다 — 보정하지 않는다", async () => {
      const res = await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({
          businessHours: {
            days: [
              {
                day: 1,
                closed: false,
                open: "20:00",
                close: "02:00",
                breaks: [],
              },
            ],
            closedOnPublicHolidays: false,
            note: null,
          },
        })
        .expect(200);

      const hours = (
        res.body as { data: { tenant: { businessHours: BusinessHours } } }
      ).data.tenant.businessHours;
      // close < open 은 오류가 아니라 애견호텔의 정상 영업이다 (§2.1).
      expect(hours.days[1].open).toBe("20:00");
      expect(hours.days[1].close).toBe("02:00");
    });

    it("마감 24:00 을 허용한다 — 00:00~24:00 이 곧 24시간 영업이다", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({
          businessHours: {
            days: [
              {
                day: 1,
                closed: false,
                open: "00:00",
                close: "24:00",
                breaks: [],
              },
            ],
            closedOnPublicHolidays: false,
            note: null,
          },
        })
        .expect(200);
    });

    it("시작 시각으로 24:00 은 거절한다", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({
          businessHours: {
            days: [
              {
                day: 1,
                closed: false,
                open: "24:00",
                close: "02:00",
                breaks: [],
              },
            ],
            closedOnPublicHolidays: false,
            note: null,
          },
        })
        .expect(400);
    });

    it("시작과 종료가 같으면 거절한다 — '0분 영업'과 24시간 영업이 구분되지 않는다", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({
          businessHours: {
            days: [
              {
                day: 1,
                closed: false,
                open: "09:00",
                close: "09:00",
                breaks: [],
              },
            ],
            closedOnPublicHolidays: false,
            note: null,
          },
        })
        .expect(400);
    });

    it("영업시간 밖의 휴게시간을 거절한다", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({
          businessHours: {
            days: [
              {
                day: 1,
                closed: false,
                open: "09:00",
                close: "19:00",
                breaks: [{ start: "20:00", end: "21:00" }],
              },
            ],
            closedOnPublicHolidays: false,
            note: null,
          },
        })
        .expect(400);
    });

    it("서로 겹치는 휴게시간을 거절한다", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({
          businessHours: {
            days: [
              {
                day: 1,
                closed: false,
                open: "09:00",
                close: "19:00",
                breaks: [
                  { start: "12:00", end: "13:30" },
                  { start: "13:00", end: "14:00" },
                ],
              },
            ],
            closedOnPublicHolidays: false,
            note: null,
          },
        })
        .expect(400);
    });

    it("형식이 어긋난 시각은 DTO 단계에서 거절한다", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({
          businessHours: {
            days: [
              {
                day: 1,
                closed: false,
                open: "9시",
                close: "19:00",
                breaks: [],
              },
            ],
            closedOnPublicHolidays: false,
            note: null,
          },
        })
        .expect(400);
    });

    it("null 을 보내면 '등록 해제'다 (미전달과 구분된다)", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: openEveryDay() })
        .expect(200);

      // businessHours 를 아예 안 보내면 건드리지 않는다.
      const untouched = await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ name: "운영시간 유치원" })
        .expect(200);
      expect(
        (untouched.body as { data: { tenant: { businessHours: unknown } } })
          .data.tenant.businessHours,
      ).not.toBeNull();

      // 명시적 null 만 지운다.
      const cleared = await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: null })
        .expect(200);
      expect(
        (cleared.body as { data: { tenant: { businessHours: unknown } } }).data
          .tenant.businessHours,
      ).toBeNull();
    });

    it("망가진 JSONB 가 들어 있으면 읽을 때 null 로 떨어뜨린다 (부분 복구하지 않는다)", async () => {
      // DB 를 직접 오염시킨다 — 옛 행이나 손으로 고친 행을 흉내낸다. JSONB 는 DB 가
      // 모양을 검사해 주지 않으므로 이 경로가 실제로 존재한다.
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { businessHours: { days: "이건 배열이 아니다" } },
      });

      const res = await asTenant(owner.session, tenantId)
        .get(`${V1_TENANTS()}/settings`)
        .expect(200);

      // 부분적으로 살려내면 원장이 넣은 적 없는 시간이 화면에 뜬다.
      expect(
        (res.body as { data: { tenant: { businessHours: unknown } } }).data
          .tenant.businessHours,
      ).toBeNull();
    });

    it("공개 디렉터리에 운영시간이 실린다 (상세주소는 여전히 빠진다)", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: openEveryDay(), isListed: true })
        .expect(200);

      // @Public() 경로라 세션 없이 부른다.
      const res = await asTenant(owner.session, tenantId)
        .get(`${V1_TENANTS()}/directory?search=hourstest`)
        .expect(200);

      const tenants = (
        res.body as {
          data: {
            tenants: {
              subdomain: string;
              businessHours: BusinessHours | null;
              addressDetail?: unknown;
            }[];
          };
        }
      ).data.tenants;

      const found = tenants.find((item) => item.subdomain === "hourstest");
      expect(found?.businessHours?.days).toHaveLength(7);
      // 소규모 매장은 상세주소가 곧 자택 호수다 (job-059).
      expect(found).not.toHaveProperty("addressDetail");
    });

    it("GUARDIAN 은 운영시간을 고칠 수 없다", async () => {
      const guardian = await signupAndLogin(server(), {
        email: "guardian@hours.test",
        nickname: "보호자",
      });
      await grantMembership(guardian.userId, tenantId, ROLES.GUARDIAN);

      await asTenant(guardian.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: openEveryDay() })
        .expect(403);
    });
  });

  // ── 임시 휴무 ───────────────────────────────────────────────────────────

  describe("임시 휴무일", () => {
    beforeAll(async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: openEveryDay() })
        .expect(200);
    });

    afterEach(async () => {
      await prisma.tenantClosure.deleteMany();
      await prisma.petSchedule.deleteMany();
      await prisma.notificationLog.deleteMany();
      await prisma.attendance.deleteMany();
    });

    it("등록하면 목록에 사유와 함께 뜬다", async () => {
      const date = toKey(daysFromNow(10));

      await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date, reason: "설 연휴" })
        .expect(201);

      const res = await asTenant(owner.session, tenantId)
        .get(`${V1_TENANTS()}/settings/closures`)
        .expect(200);

      const closures = (
        res.body as { data: { closures: { date: string; reason: string }[] } }
      ).data.closures;
      // 사유가 보호자에게 그대로 보이는 값이라 왕복에서 살아남아야 한다 (§3.3).
      expect(closures).toContainEqual(
        expect.objectContaining({ date, reason: "설 연휴" }),
      );
    });

    it("같은 날을 두 번 등록하면 409 — 달력이 같은 휴무를 두 줄로 보여주면 안 된다", async () => {
      const date = toKey(daysFromNow(11));
      await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date })
        .expect(201);

      await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date })
        .expect(409);
    });

    it("지난 날짜는 휴무로 지정할 수 없다", async () => {
      await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date: toKey(daysFromNow(-1)) })
        .expect(400);
    });

    it("해제하면 목록에서 사라진다 — 다만 예약은 복구하지 않는다", async () => {
      const date = toKey(daysFromNow(12));
      await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date })
        .expect(201);

      await asTenant(owner.session, tenantId)
        .delete(`${V1_TENANTS()}/settings/closures/${date}`)
        .expect(200);

      const res = await asTenant(owner.session, tenantId)
        .get(`${V1_TENANTS()}/settings/closures`)
        .expect(200);
      const closures = (res.body as { data: { closures: { date: string }[] } })
        .data.closures;
      expect(closures.map((item) => item.date)).not.toContain(date);

      // §3.2 — 되살리면 보호자가 모르는 예약이 하나 더 생긴다.
      expect(
        await prisma.petSchedule.count({ where: { date: new Date(date) } }),
      ).toBe(0);
    });

    it("없는 휴무를 해제하면 404", async () => {
      await asTenant(owner.session, tenantId)
        .delete(`${V1_TENANTS()}/settings/closures/${toKey(daysFromNow(13))}`)
        .expect(404);
    });
  });

  // ── 휴무 통보 (§3.1.1) ──────────────────────────────────────────────────

  describe("휴무 지정 시 보호자 통보", () => {
    let petId: string;

    beforeAll(async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: openEveryDay() })
        .expect(200);

      const created = await createGuardianWithPet(server(), tenantId, {
        email: "guardian-notify@hours.test",
        nickname: "통보보호자",
        petName: "초코",
      });
      petId = created.petId;

      // 알림은 계정이 아니라 전화번호로 나간다 (job-040).
      await prisma.pet.update({
        where: { id: petId },
        data: { guardianPhone: "01012345678" },
      });
    });

    afterEach(async () => {
      await prisma.tenantClosure.deleteMany();
      await prisma.petSchedule.deleteMany();
      await prisma.notificationLog.deleteMany();
      await prisma.attendance.deleteMany();
      await prisma.pet.update({
        where: { id: petId },
        data: { scheduleType: "MONTHLY", scheduleDays: [] },
      });
    });

    it("예약이 있던 날을 휴무로 지정하면 예약이 풀리고 통보 대상이 된다", async () => {
      const target = daysFromNow(14);
      const date = toKey(target);

      await prisma.petSchedule.create({
        data: { tenantId, petId, date: target, source: "GUARDIAN" },
      });

      const res = await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date, reason: "정기 소독" })
        .expect(201);

      const data = (
        res.body as {
          data: {
            releasedReservations: number;
            affectedPets: number;
            notifiedGuardians: number;
          };
        }
      ).data;

      expect(data.releasedReservations).toBe(1);
      expect(data.affectedPets).toBe(1);
      // 예약 행이 실제로 사라졌는지 — 남으면 보호자 화면에는 예약이 살아 있다.
      expect(await prisma.petSchedule.count({ where: { petId } })).toBe(0);

      const logs = await prisma.notificationLog.findMany({
        where: { petId, type: "TENANT_CLOSURE" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].recipientPhone).toBe("01012345678");

      // ⚠️ 이 환경에는 Solapi 자격증명이 없어 알림톡·SMS 가 모두 실패하고 FAILED 로
      // 기록된다. notifiedGuardians 는 **성공한 발송만** 세므로 여기서는 0이다 —
      // 그게 의도다. 실패를 세면 화면이 "N명에게 안내를 보냈습니다"라고 거짓말한다.
      expect(data.notifiedGuardians).toBe(0);
      expect(logs[0].status).toBe("FAILED");
    });

    it("⚠️ WEEKLY 정기 등원 아이도 통보 대상이다 — 예약 행이 없어도", async () => {
      // 이 스펙이 이 파일의 존재 이유다. 삭제된 PetSchedule 행만 세는 구현으로
      // 되돌아가면 매주 그 요일에 오는 아이들이 통보에서 통째로 빠지고, 그 사람들이
      // 정확히 문 닫은 매장 앞에 선다 (§7-7).
      const target = daysFromNow(15);
      const date = toKey(target);

      await prisma.pet.update({
        where: { id: petId },
        data: { scheduleType: "WEEKLY", scheduleDays: [target.getDay()] },
      });

      const res = await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date, reason: "워크샵" })
        .expect(201);

      const data = (
        res.body as {
          data: { releasedReservations: number; affectedPets: number };
        }
      ).data;

      // 지울 행이 애초에 없다 — 요일 패턴은 날짜 행으로 저장되지 않는다 (job-053).
      expect(data.releasedReservations).toBe(0);
      // 그런데도 그 아이는 그 날 온다. 반드시 통보 대상이어야 한다.
      expect(data.affectedPets).toBe(1);

      const logs = await prisma.notificationLog.findMany({
        where: { petId, type: "TENANT_CLOSURE" },
      });
      expect(logs).toHaveLength(1);
    });

    it("이미 등원 체크가 끝난 아이는 통보하지 않는다", async () => {
      // 오늘을 휴무로 지정하는 것은 허용된다. 다만 이미 아이를 데려다준 사람에게
      // "등원이 취소되었습니다"는 사실과 다르다.
      const today = daysFromNow(0);
      const date = toKey(today);

      await prisma.petSchedule.create({
        data: { tenantId, petId, date: today, source: "GUARDIAN" },
      });
      await prisma.attendance.create({
        data: { tenantId, petId, date: today, status: "CHECKED_IN" },
      });

      const res = await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date })
        .expect(201);

      const data = (res.body as { data: { affectedPets: number } }).data;
      expect(data.affectedPets).toBe(0);
      expect(
        await prisma.notificationLog.count({
          where: { petId, type: "TENANT_CLOSURE" },
        }),
      ).toBe(0);
    });

    it("연락처가 없는 아이는 통보되지 않지만 대상 수에는 남는다 (원장이 직접 연락해야 한다)", async () => {
      const target = daysFromNow(16);
      const date = toKey(target);

      await prisma.pet.update({
        where: { id: petId },
        data: { guardianPhone: null },
      });
      // 계정 번호 폴백(resolveGuardianPhone)도 끊어 둔다.
      await prisma.user.updateMany({
        where: { pets: { some: { id: petId } } },
        data: { phone: null },
      });
      await prisma.petSchedule.create({
        data: { tenantId, petId, date: target, source: "GUARDIAN" },
      });

      const res = await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date })
        .expect(201);

      const data = (
        res.body as {
          data: { affectedPets: number; notifiedGuardians: number };
        }
      ).data;

      // 대상에서 빼 버리면 그 차이가 사라져 아무도 챙기지 않게 된다.
      expect(data.affectedPets).toBe(1);
      expect(data.notifiedGuardians).toBe(0);
      expect(
        await prisma.notificationLog.count({
          where: { petId, type: "TENANT_CLOSURE" },
        }),
      ).toBe(0);

      await prisma.pet.update({
        where: { id: petId },
        data: { guardianPhone: "01012345678" },
      });
    });

    it("그 날 오는 아이가 없으면 통보도 없다", async () => {
      const res = await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date: toKey(daysFromNow(17)) })
        .expect(201);

      const data = (
        res.body as {
          data: {
            affectedPets: number;
            releasedReservations: number;
            notifiedGuardians: number;
          };
        }
      ).data;
      expect(data).toEqual(
        expect.objectContaining({
          affectedPets: 0,
          releasedReservations: 0,
          notifiedGuardians: 0,
        }),
      );
    });
  });
});
