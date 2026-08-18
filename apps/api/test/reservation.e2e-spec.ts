import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, prismaConnect } from "@pawlog/database";
import {
  RESERVATION_BLOCK,
  type BusinessHours,
  type ReservationCalendarResponse,
} from "@pawlog/shared";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";
import {
  asTenant,
  cleanupAll,
  createGuardianWithPet,
  openTenant,
  prefix,
  signupAndLogin,
  type SignedUpUser,
} from "./utils/tenant-setup";

/**
 * 보호자 등원 예약 e2e (job-060).
 *
 * 설계 근거는 `docs/business-hours-and-reservations.md` §4. 이 스펙이 지키는 것:
 *
 *   · 예약은 **이용권을 차감하지 않는다** — 차감 지점은 등원 체크 하나뿐이다 (§7-4)
 *   · 한도는 `잔액 − 앞으로의 등원 예정일` 이고, 그 예정일에 **WEEKLY 요일 패턴이
 *     포함된다** (§4.2). 빠지면 한도가 사실상 사라져 매장이 공짜로 받게 된다
 *   · 차단 사유(`blockedBy`)를 **판정 순서까지** 지켜 내려준다 (§4.3)
 *   · 하나라도 막히면 **전부** 거절한다 (§4.4)
 *   · 원장의 월별 스케줄 저장이 **보호자 예약을 지우지 않는다** (§7-5)
 *
 * 보호자는 **개인 스코프**에서 부른다 — `X-Tenant-Id` 를 붙이지 않는다(§4.6). 그래서
 * 아래 요청들은 `asTenant()` 를 거치지 않고 세션으로 직접 부른다.
 */

const V1_PETS = () => `${prefix()}/v1/pets`;
const V1_TENANTS = () => `${prefix()}/v1/tenants`;
const V1_LEDGERS = () => `${prefix()}/v1/subscriptions/ledgers`;
const V1_ADMIN = () => `${prefix()}/v1/admin`;

const toKey = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

/** 요일 무관하게 열려 있는 시간표 — 날짜 판정을 요일에서 떼어낸다. */
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

/**
 * 테스트는 **다음 달**에서 논다. 이번 달을 쓰면 오늘이 며칠이냐에 따라 남은 날이 모자라
 * 어떤 달에는 통과하고 어떤 달에는 실패하는 스펙이 된다. 다음 달은 1~28일이 언제나
 * 미래이고 언제나 존재한다.
 */
const now = new Date();
const NEXT_MONTH = new Date(now.getFullYear(), now.getMonth() + 1, 1);
const MONTH_KEY = `${NEXT_MONTH.getFullYear()}-${`${NEXT_MONTH.getMonth() + 1}`.padStart(2, "0")}`;

/** 다음 달 n일 (1~28). */
const dayOfNextMonth = (n: number): Date =>
  new Date(NEXT_MONTH.getFullYear(), NEXT_MONTH.getMonth(), n);

/** 다음 달에서 그 요일에 해당하는 첫 날짜 (1~28 안에서). */
const firstWeekdayOfNextMonth = (weekday: number): Date => {
  for (let day = 1; day <= 28; day += 1) {
    const date = dayOfNextMonth(day);
    if (date.getDay() === weekday) return date;
  }
  throw new Error("도달할 수 없음 — 28일이면 모든 요일이 한 번은 나온다.");
};

type CalendarBody = { data: ReservationCalendarResponse };

describe("Reservation (e2e) — 보호자 등원 예약 (job-060)", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  let owner: SignedUpUser;
  let tenantId: string;
  let guardian: SignedUpUser;
  /** 잔액 10회. 대부분의 스펙이 쓴다. */
  let petMain: string;
  /** 이용권을 한 번도 산 적 없는 아이 (잔액 0). */
  let petNoBalance: string;

  /** 그 달의 달력을 개인 스코프로 조회한다. */
  const calendar = async (
    session: ReturnType<typeof request.agent>,
    petId: string,
    month: string = MONTH_KEY,
  ): Promise<ReservationCalendarResponse> => {
    const res = await session
      .get(`${V1_PETS()}/${petId}/reservations?month=${month}`)
      .expect(200);
    return (res.body as CalendarBody).data;
  };

  const dayOf = (data: ReservationCalendarResponse, date: string) => {
    const found = data.days.find((day) => day.date === date);
    if (!found) throw new Error(`달력에 ${date} 가 없습니다.`);
    return found;
  };

  beforeAll(async () => {
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
      email: "owner@reserve.test",
      nickname: "원장",
    });
    const tenant = await openTenant(owner, {
      name: "예약 유치원",
      subdomain: "reservetest",
    });
    tenantId = tenant.id;

    await asTenant(owner.session, tenantId)
      .patch(`${V1_TENANTS()}/settings`)
      .send({ businessHours: openEveryDay() })
      .expect(200);

    const created = await createGuardianWithPet(server(), tenantId, {
      email: "guardian@reserve.test",
      nickname: "보호자",
      petName: "초코",
    });
    guardian = created.owner;
    petMain = created.petId;

    // 이용권 10회 — 예약 한도의 상한이 된다.
    await asTenant(owner.session, tenantId)
      .post(`${V1_LEDGERS()}/charge`)
      .send({ petId: petMain, amount: 10 })
      .expect(201);

    // 같은 보호자의 둘째 아이 — 이용권을 산 적이 없다.
    const petRes = await guardian.session
      .post(V1_PETS())
      .send({ name: "두부", species: "DOG" })
      .expect(201);
    petNoBalance = (petRes.body as { data: { pet: { id: string } } }).data.pet
      .id;
    await guardian.session
      .post(`${V1_PETS()}/${petNoBalance}/enroll`)
      .send({ tenantId })
      .expect(200);
  });

  afterAll(async () => {
    await cleanupAll();
    await app.close();
  });

  afterEach(async () => {
    await prisma.petSchedule.deleteMany();
    await prisma.tenantClosure.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.pet.updateMany({
      data: { scheduleType: "MONTHLY", scheduleDays: [] },
    });
  });

  // ── 달력 조회 ───────────────────────────────────────────────────────────

  describe("달력 — 판정은 서버가 끝낸다", () => {
    it("잔액과 남은 예약 가능 횟수를 함께 내려준다", async () => {
      const data = await calendar(guardian.session, petMain);

      expect(data.petName).toBe("초코");
      expect(data.balance).toBe(10);
      expect(data.reservedAhead).toBe(0);
      expect(data.remaining).toBe(10);
      expect(data.tenant?.subdomain).toBe("reservetest");
      // 열려 있는 날은 영업시간 문구가 함께 온다 — 화면이 다시 계산하지 않게 (§6.3).
      expect(dayOf(data, toKey(dayOfNextMonth(10))).hours).toBeTruthy();
    });

    it("지난 달은 전부 PAST 다 — 고칠 수 없는 사유가 가장 먼저 온다", async () => {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevKey = `${prev.getFullYear()}-${`${prev.getMonth() + 1}`.padStart(2, "0")}`;

      const data = await calendar(guardian.session, petMain, prevKey);
      expect(
        data.days.every((day) => day.blockedBy === RESERVATION_BLOCK.PAST),
      ).toBe(true);
    });

    it("요일 시간표상 쉬는 날은 CLOSED", async () => {
      const sunday = firstWeekdayOfNextMonth(0);
      const hours = openEveryDay();
      hours.days[0].closed = true;

      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: hours })
        .expect(200);

      const data = await calendar(guardian.session, petMain);
      const day = dayOf(data, toKey(sunday));
      expect(day.open).toBe(false);
      expect(day.blockedBy).toBe(RESERVATION_BLOCK.CLOSED);

      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: openEveryDay() })
        .expect(200);
    });

    it("임시 휴무는 TEMPORARILY_CLOSED 이고 사유가 함께 온다", async () => {
      const target = dayOfNextMonth(12);
      await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date: toKey(target), reason: "정기 소독" })
        .expect(201);

      const data = await calendar(guardian.session, petMain);
      const day = dayOf(data, toKey(target));
      expect(day.blockedBy).toBe(RESERVATION_BLOCK.TEMPORARILY_CLOSED);
      // 사유 없이 잠긴 날은 보호자에게 전부 똑같아 보여 결국 매장에 전화한다 (§3.3).
      expect(day.closedReason).toBe("정기 소독");
    });

    it("⚠️ 임시 휴무를 정기 휴무보다 먼저 본다 — 적어 둔 사유를 보여주는 편이 낫다", async () => {
      const sunday = firstWeekdayOfNextMonth(0);
      const hours = openEveryDay();
      hours.days[0].closed = true;

      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: hours })
        .expect(200);
      await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date: toKey(sunday), reason: "설 연휴" })
        .expect(201);

      const data = await calendar(guardian.session, petMain);
      // "원래 일요일은 쉰다"가 더 정확하지만, 매장이 굳이 그 날을 지정했다는 건
      // 사유를 적어 뒀다는 뜻이다 (§4.3).
      expect(dayOf(data, toKey(sunday)).blockedBy).toBe(
        RESERVATION_BLOCK.TEMPORARILY_CLOSED,
      );

      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: openEveryDay() })
        .expect(200);
    });

    it("잔액이 0이면 NO_BALANCE", async () => {
      const data = await calendar(guardian.session, petNoBalance);
      expect(data.balance).toBe(0);
      expect(dayOf(data, toKey(dayOfNextMonth(10))).blockedBy).toBe(
        RESERVATION_BLOCK.NO_BALANCE,
      );
    });

    it("어느 유치원에도 없는 아이는 NOT_ENROLLED", async () => {
      const res = await guardian.session
        .post(V1_PETS())
        .send({ name: "미등록", species: "DOG" })
        .expect(201);
      const petId = (res.body as { data: { pet: { id: string } } }).data.pet.id;

      const data = await calendar(guardian.session, petId);
      expect(data.tenant).toBeNull();
      expect(dayOf(data, toKey(dayOfNextMonth(10))).blockedBy).toBe(
        RESERVATION_BLOCK.NOT_ENROLLED,
      );

      await prisma.pet.delete({ where: { id: petId } });
    });

    it("매장이 운영시간을 등록하지 않았으면 달력이 통째로 잠긴다", async () => {
      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: null })
        .expect(200);

      const data = await calendar(guardian.session, petMain);
      expect(data.businessHours).toBeNull();
      // 미등록을 "매일 휴무(CLOSED)"로 말하면 보호자는 폐업한 매장으로 읽는다 (§2.1).
      expect(dayOf(data, toKey(dayOfNextMonth(10))).blockedBy).toBe(
        RESERVATION_BLOCK.NO_BUSINESS_HOURS,
      );

      await asTenant(owner.session, tenantId)
        .patch(`${V1_TENANTS()}/settings`)
        .send({ businessHours: openEveryDay() })
        .expect(200);
    });

    it("남의 아이는 404 — 존재 여부조차 알려주지 않는다", async () => {
      await owner.session
        .get(`${V1_PETS()}/${petMain}/reservations?month=${MONTH_KEY}`)
        .expect(404);
    });
  });

  // ── 예약 생성 ───────────────────────────────────────────────────────────

  describe("예약 생성", () => {
    it("예약하면 GUARDIAN 행이 생기고 그 날은 ALREADY 가 된다", async () => {
      const dates = [toKey(dayOfNextMonth(5)), toKey(dayOfNextMonth(7))];

      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates })
        .expect(201);

      const rows = await prisma.petSchedule.findMany({
        where: { petId: petMain },
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.source === "GUARDIAN")).toBe(true);

      const data = await calendar(guardian.session, petMain);
      expect(data.remaining).toBe(8);
      const day = dayOf(data, dates[0]);
      expect(day.blockedBy).toBe(RESERVATION_BLOCK.ALREADY);
      expect(day.reserved).toBe(true);
      expect(day.cancelable).toBe(true);
    });

    it("⚠️ 예약은 이용권을 차감하지 않는다 — 차감 지점은 등원 체크 하나뿐이다", async () => {
      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates: [toKey(dayOfNextMonth(6))] })
        .expect(201);

      const data = await calendar(guardian.session, petMain);
      // 잔액은 그대로고, 줄어드는 것은 "예약 가능 횟수"뿐이다 (§4.1).
      expect(data.balance).toBe(10);
      expect(data.remaining).toBe(9);
      expect(
        await prisma.subscriptionLedger.count({ where: { petId: petMain } }),
      ).toBe(1);
    });

    it("⚠️ 하나라도 막히면 전부 거절한다 — 부분 성공은 없다", async () => {
      const good = toKey(dayOfNextMonth(8));
      const past = toKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates: [good, past] })
        .expect(400);

      // 되는 것만 골라 넣고 성공으로 돌려주면 보호자는 5일을 골랐는데 3일만 잡힌 걸
      // 모른 채 화면을 떠난다 (§4.4).
      expect(
        await prisma.petSchedule.count({ where: { petId: petMain } }),
      ).toBe(0);
    });

    it("휴무일은 서버가 마지막 방어선으로 거절한다", async () => {
      const target = dayOfNextMonth(9);
      await asTenant(owner.session, tenantId)
        .post(`${V1_TENANTS()}/settings/closures`)
        .send({ date: toKey(target) })
        .expect(201);

      // 달력을 열어 둔 사이에 매장이 그 날을 휴무로 지정했을 수 있다.
      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates: [toKey(target)] })
        .expect(400);
    });

    it("잔액을 넘겨 예약하면 거절한다", async () => {
      const dates = Array.from({ length: 11 }, (_, index) =>
        toKey(dayOfNextMonth(index + 1)),
      );

      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates })
        .expect(400);
      expect(
        await prisma.petSchedule.count({ where: { petId: petMain } }),
      ).toBe(0);
    });

    it("잔액을 다 쓰면 SCHEDULE_FULL — NO_BALANCE 와 구분한다", async () => {
      const dates = Array.from({ length: 10 }, (_, index) =>
        toKey(dayOfNextMonth(index + 1)),
      );
      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates })
        .expect(201);

      const data = await calendar(guardian.session, petMain);
      expect(data.remaining).toBe(0);
      // 10회권을 방금 산 사람에게 "이용권이 없습니다"라고 말하면 안 된다. 그 사람이
      // 할 일은 충전이 아니라 예약 조정이다 (§4.3).
      expect(dayOf(data, toKey(dayOfNextMonth(20))).blockedBy).toBe(
        RESERVATION_BLOCK.SCHEDULE_FULL,
      );
    });

    it("같은 날짜를 두 번 보내면 한 번으로 친다", async () => {
      const date = toKey(dayOfNextMonth(11));
      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates: [date, date] })
        .expect(201);

      expect(
        await prisma.petSchedule.count({ where: { petId: petMain } }),
      ).toBe(1);
    });

    it("빈 배열은 거절한다", async () => {
      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates: [] })
        .expect(400);
    });
  });

  // ── 한도에 정기 등원일이 포함된다 (§4.2) ────────────────────────────────

  describe("⚠️ 한도 — WEEKLY 정기 등원일도 센다", () => {
    let petWeekly: string;
    let weeklyGuardian: SignedUpUser;

    beforeAll(async () => {
      const created = await createGuardianWithPet(server(), tenantId, {
        email: "guardian-weekly@reserve.test",
        nickname: "정기보호자",
        petName: "몽이",
      });
      petWeekly = created.petId;
      weeklyGuardian = created.owner;

      await asTenant(owner.session, tenantId)
        .post(`${V1_LEDGERS()}/charge`)
        .send({ petId: petWeekly, amount: 3 })
        .expect(201);

      // 매주 월요일에 오는 아이. 요일 패턴은 **날짜 행으로 저장되지 않는다**(job-053).
      await asTenant(owner.session, tenantId)
        .put(`${V1_ADMIN()}/pets/${petWeekly}/schedule`)
        .send({ scheduleType: "WEEKLY", scheduleDays: [1] })
        .expect(200);
    });

    it("정기 등원일 때문에 남은 횟수가 0이면 다른 날은 SCHEDULE_FULL 이다", async () => {
      // 이 스펙이 §4.2 의 핵심이다. 요일 패턴을 세지 않으면 reservedAhead 가 0으로
      // 나와 한도가 사실상 사라지고, 그 아이는 잔액 0으로 등원해 매장이 공짜로 받는다.
      const data = await calendar(weeklyGuardian.session, petWeekly);

      // 잔액 3 = 앞으로 오는 월요일 3번. 남는 것이 없다.
      expect(data.balance).toBe(3);
      expect(data.reservedAhead).toBe(3);
      expect(data.remaining).toBe(0);

      // 월요일은 "이미 등원 예정"이고,
      expect(dayOf(data, toKey(firstWeekdayOfNextMonth(1))).blockedBy).toBe(
        RESERVATION_BLOCK.ALREADY,
      );
      // 수요일은 잔액이 남아 있지 않아 막힌다 — 잔액 자체는 3이므로 NO_BALANCE 가 아니다.
      expect(dayOf(data, toKey(firstWeekdayOfNextMonth(3))).blockedBy).toBe(
        RESERVATION_BLOCK.SCHEDULE_FULL,
      );

      await weeklyGuardian.session
        .post(`${V1_PETS()}/${petWeekly}/reservations`)
        .send({ dates: [toKey(firstWeekdayOfNextMonth(3))] })
        .expect(400);
    });
  });

  // ── 취소 (§4.5) ─────────────────────────────────────────────────────────

  describe("예약 취소", () => {
    it("자기가 잡은 미래의 예약은 취소할 수 있다", async () => {
      const date = toKey(dayOfNextMonth(14));
      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates: [date] })
        .expect(201);

      await guardian.session
        .delete(`${V1_PETS()}/${petMain}/reservations/${date}`)
        .expect(200);

      expect(
        await prisma.petSchedule.count({ where: { petId: petMain } }),
      ).toBe(0);
    });

    it("원장이 지정한 등원일은 취소할 수 없다 — 매장 운영 계획이 말없이 바뀐다", async () => {
      const date = dayOfNextMonth(15);
      await prisma.petSchedule.create({
        data: { tenantId, petId: petMain, date, source: "ADMIN" },
      });

      await guardian.session
        .delete(`${V1_PETS()}/${petMain}/reservations/${toKey(date)}`)
        .expect(400);
      expect(
        await prisma.petSchedule.count({ where: { petId: petMain } }),
      ).toBe(1);
    });

    it("이미 등원한 날은 취소할 수 없다 — 출석은 계획이 아니라 사실이다", async () => {
      const date = dayOfNextMonth(16);
      await prisma.petSchedule.create({
        data: { tenantId, petId: petMain, date, source: "GUARDIAN" },
      });
      await prisma.attendance.create({
        data: { tenantId, petId: petMain, date, status: "CHECKED_IN" },
      });

      await guardian.session
        .delete(`${V1_PETS()}/${petMain}/reservations/${toKey(date)}`)
        .expect(400);
    });

    it("지난 날짜는 취소할 수 없다", async () => {
      const past = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      await prisma.petSchedule.create({
        data: { tenantId, petId: petMain, date: past, source: "GUARDIAN" },
      });

      await guardian.session
        .delete(`${V1_PETS()}/${petMain}/reservations/${toKey(past)}`)
        .expect(400);
    });

    it("예약이 없는 날을 취소하면 404", async () => {
      await guardian.session
        .delete(
          `${V1_PETS()}/${petMain}/reservations/${toKey(dayOfNextMonth(17))}`,
        )
        .expect(404);
    });
  });

  // ── 원장 스케줄 저장과의 공존 (§7-5) ────────────────────────────────────

  describe("⚠️ 원장의 월별 스케줄 저장이 보호자 예약을 지우지 않는다", () => {
    it("ADMIN 행만 교체된다", async () => {
      const guardianDate = toKey(dayOfNextMonth(21));
      const adminDateOld = dayOfNextMonth(22);
      const adminDateNew = toKey(dayOfNextMonth(23));

      await guardian.session
        .post(`${V1_PETS()}/${petMain}/reservations`)
        .send({ dates: [guardianDate] })
        .expect(201);
      await prisma.petSchedule.create({
        data: { tenantId, petId: petMain, date: adminDateOld, source: "ADMIN" },
      });

      // 원장이 그 달 달력을 저장한다 — 자기가 고른 날만 남기려는 조작이다.
      await asTenant(owner.session, tenantId)
        .put(`${V1_ADMIN()}/pets/${petMain}/schedule`)
        .send({
          scheduleType: "MONTHLY",
          month: MONTH_KEY,
          dates: [adminDateNew],
        })
        .expect(200);

      const rows = await prisma.petSchedule.findMany({
        where: { petId: petMain },
        orderBy: { date: "asc" },
      });

      // 범위로만 지우면 원장이 달력을 한 번 저장하는 순간 그 달의 보호자 예약이 통째로
      // 사라지는데, 보호자에게 알림이 가지 않아 아이를 데려온 날에야 드러난다.
      expect(rows.map((row) => toKey(row.date))).toEqual([
        guardianDate,
        adminDateNew,
      ]);
      expect(rows.find((row) => toKey(row.date) === guardianDate)?.source).toBe(
        "GUARDIAN",
      );
    });
  });
});
