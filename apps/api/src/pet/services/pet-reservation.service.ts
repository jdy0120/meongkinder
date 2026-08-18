import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, runWithoutTenant, runWithTenant } from "@pawlog/database";
import {
  RESERVATION_BLOCK,
  RESERVATION_BLOCK_MESSAGE,
  SCHEDULE_SOURCE,
  SCHEDULE_TYPE,
  datesOfWeekdaysInMonth,
  formatBusinessDay,
  fromDateKey,
  isOpenOn,
  parseBusinessHours,
  toDateKey,
  upcomingWeekdayDates,
  type BusinessHours,
  type ReservationBlock,
  type ReservationCalendarResponse,
  type ReservationDay,
} from "@pawlog/shared";

import { SubscriptionLedgerService } from "../../subscription/services/subscription-ledger.service";
import { ensureScheduledAttendance, startOfToday } from "../../shared/utils";
import { CreateReservationDto } from "../dtos";

/**
 * 등원 예약 (job-060) — **보호자가** 아이가 갈 날을 직접 고른다.
 *
 * ## 저장은 `PetSchedule` 에 한다
 *
 * 예약 전용 테이블을 만들지 않았다. 담는 사실이 "이 아이가 이 날 온다"로 원장이 짠
 * 등원일과 완전히 같기 때문이다. 나누면 그 사실을 읽는 네 곳(오늘의 출석부 자동 생성 ·
 * 피드 커버리지 · 태그 후보 · 등원 알림)이 전부 두 테이블을 합쳐 읽어야 하고, 한 곳만
 * 빠뜨리면 **예약은 됐는데 출석부에 안 뜨는** 상태가 된다. 구분은 `source` 칸이 한다.
 *
 * ## 이용권은 여기서 차감하지 않는다
 *
 * 차감은 지금도 앞으로도 등원 체크 한 곳에서만 일어난다(`AttendanceService`). 예약
 * 시점에 깎으면 ① 취소마다 역분개가 필요해지고 차감 지점이 둘이 되어 반드시 한쪽만
 * 고쳐지며 ② 예약해 놓고 오지 않은 날이 차감된다. 대신 **예약 가능 횟수 = 잔액 −
 * 오늘 이후 예약 수** 로 판정한다 — 10회권으로 30일을 잡는 일은 막으면서, 돈은 아이가
 * 실제로 온 날에만 움직인다.
 *
 * ## 스코프
 *
 * 보호자는 **개인 스코프**에서 이 API 를 부른다(`X-Tenant-Id` 가 없다). 그래서 소유
 * 검사의 기준은 매장이 아니라 `pet.userId = 나` 이고, 조회는 `runWithoutTenant` 로
 * 자동 주입을 명시적으로 끈다. 쓰기는 반대로 아이가 속한 매장을 **명시해서** 연다 —
 * `PetSchedule.tenantId` 는 NOT NULL 이고, 그 매장은 아이가 등록된 곳 하나뿐이다.
 */
/**
 * 그 날의 이용권 사용 여부가 **이미 결판난** 출석 상태 (job-063).
 *
 * 예약 한도는 "앞으로 이용권을 몇 번 더 쓸 것인가"를 세는 것이므로, 결과가 정해진 날은
 * 세지 않는다. `SCHEDULED`(아직 안 옴)와 `MAKEUP`(보강 예정)만 남는다.
 */
const SETTLED_ATTENDANCE = [
  "CHECKED_IN",
  "CHECKED_OUT",
  "ABSENT",
  "CANCELED",
];

@Injectable()
export class PetReservationService {
  constructor(private readonly ledgerService: SubscriptionLedgerService) {}

  /** `"YYYY-MM"` → `{ year, month }`. 형식은 DTO 가 이미 봤다. */
  private parseMonth(month: string) {
    const [year, monthOfYear] = month.split("-").map(Number);
    return { year: year, month: monthOfYear };
  }

  private currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
  }

  /**
   * 본인 소유 아이 + 소속 매장을 함께 읽는다.
   *
   * 매장은 `null` 일 수 있다 — 어떤 유치원에도 등록하지 않은 개인 반려동물이다. 그
   * 경우 예약할 곳이 없으므로 달력은 통째로 잠기고 사유(`NOT_ENROLLED`)를 말한다.
   */
  private async requireOwnPet(userId: string, petId: string) {
    const pet = await runWithoutTenant(() =>
      prisma.pet.findFirst({
        where: { id: petId, userId },
        select: {
          id: true,
          name: true,
          tenantId: true,
          // job-060: 정기 등원일도 예약 한도를 먹는다 — 그 날도 아이가 오고, 오면
          // 이용권을 쓰기 때문이다.
          scheduleType: true,
          scheduleDays: true,
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              isActive: true,
              businessHours: true,
            },
          },
        },
      }),
    );

    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }
    return pet;
  }

  /**
   * 이 아이에게 **실제로 유효한** 등원일 행의 where 조각 (job-060).
   *
   * ⚠️ `scheduledOn`(shared/utils/schedule.ts)과 **같은 규칙이어야 한다.** 거기서는 WEEKLY
   * 아이의 `ADMIN` 행을 무시하는데(MONTHLY→WEEKLY 로 방식을 바꿨을 때 남은 옛 행이
   * 되살아나지 않도록), 여기서 그걸 세면 **오지도 않을 날이 예약 한도를 깎는다.** 두 곳이
   * 갈라지면 보호자는 "달력엔 등원 예정이라는데 출석부엔 없는" 날을 보게 된다.
   */
  private scheduleRowFilter(scheduleType: string) {
    return scheduleType === SCHEDULE_TYPE.WEEKLY
      ? { source: SCHEDULE_SOURCE.GUARDIAN }
      : {};
  }

  /**
   * 예약 한도 계산 — **총 예정 등원일 ≤ 이용권 잔액** (job-060).
   *
   * 세는 대상은 "앞으로 이 아이가 올 날" 전부다:
   *
   *   · 보호자가 잡은 예약        (`GUARDIAN` 행)
   *   · 원장이 지정한 날          (`ADMIN` 행 — MONTHLY 아이만)
   *   · **매주 반복하는 정기 등원일** (WEEKLY 아이의 요일 패턴)
   *
   * 마지막 것을 빼면 한도가 사실상 없는 것과 같았다. 요일 패턴은 날짜 행으로 저장되지
   * 않으므로(job-053), 행만 세면 주 3회 다니는 10회권 아이의 `reservedAhead` 가 0으로
   * 나온다 — 정기 등원일 8일이 이미 잡혀 있는데 10일을 더 예약할 수 있었다. 그 아이는
   * 넷째 날부터 잔액 0으로 등원하고, 차감이 멈추면서 매장이 공짜로 받게 된다.
   *
   * ⚠️ **매주 반복은 끝이 없으므로 잔액까지만 센다.** 잔액을 넘겨 세 봐야 답(한도 초과)은
   * 같고, 세는 범위만 무한해진다.
   */
  private async computeQuota(
    pet: { id: string; scheduleType: string; scheduleDays: number[] },
    from: Date,
  ) {
    const [balance, rows, settled] = await Promise.all([
      runWithoutTenant(() => this.ledgerService.balanceOf(pet.id)),
      runWithoutTenant(() =>
        prisma.petSchedule.findMany({
          where: {
            petId: pet.id,
            // 지난 날짜는 세지 않는다 — 이미 지나간 예정일은 이용권을 쓸 일이 없다
            // (등원했으면 그때 차감됐고, 안 왔으면 그대로 남아 있다).
            date: { gte: from },
            ...this.scheduleRowFilter(pet.scheduleType),
          },
          select: { date: true },
        }),
      ),
      // job-063: **오늘 이미 결판난 날**. `from` 이 오늘이라 오늘은 "앞으로"에 들어가는데,
      // 그 날의 등원이 이미 끝났으면 이용권을 더 쓸 일이 없다.
      runWithoutTenant(() =>
        prisma.attendance.findMany({
          where: { petId: pet.id, date: { gte: from }, status: { in: SETTLED_ATTENDANCE } },
          select: { date: true },
        }),
      ),
    ]);

    // 결판난 날을 빼는 이유 (job-063 버그):
    //
    //   · 등원해서 차감됐다면 → 잔액이 이미 줄었다. 그 날을 또 세면 **한 번의 등원으로
    //     이용권을 두 번 쓰는 계산**이 된다.
    //   · 잔액 0이라 차감되지 않았다면(`amount: 0`) → 그 날은 그냥 지나갔다. 나중에 충전한
    //     이용권이 **이미 끝난 날에 묶여** 다음 예약에 쓰이지 못한다.
    //   · 결석·취소라면 → 아이가 오지 않으므로 이용권을 쓸 일이 없다.
    //
    // 실제로 잔액 1회인 아이가 "이미 예정된 등원일로 모두 사용될 예정"이라며 예약이
    // 막혔는데, 그 예정일이 **오늘 아침에 이미 하원까지 끝난 날**이었다. 같은 아이가
    // 같은 날 두 번 올 수는 없으므로(`@@unique([petId, date])`) 이 중복은 언제나
    // 보호자에게 손해 방향이다.
    const settledKeys = new Set(settled.map((row) => toDateKey(row.date)));

    const rowKeys = new Set(
      rows
        .map((row) => toDateKey(row.date))
        .filter((key) => !settledKeys.has(key)),
    );
    let scheduledAhead = rowKeys.size;

    if (pet.scheduleType === SCHEDULE_TYPE.WEEKLY && scheduledAhead < balance) {
      // 정기 등원일이면서 보호자가 따로 예약도 잡아 둔 날은 `rowKeys` 로 걸러 **두 번
      // 세지 않는다** — 두 번 세면 실제보다 한도가 좁아진다. 결판난 날도 같은 이유로 뺀다
      // (요일 패턴은 날짜 행이 없어 위 필터가 닿지 않으므로 여기서 함께 넘긴다).
      scheduledAhead += upcomingWeekdayDates(
        pet.scheduleDays,
        from,
        balance - scheduledAhead,
        new Set([...rowKeys, ...settledKeys]),
      ).length;
    }

    return {
      balance,
      reservedAhead: scheduledAhead,
      remaining: Math.max(0, balance - scheduledAhead),
    };
  }

  /** 그 달의 예약 달력. 판정은 전부 서버가 끝내서 내려준다 — 화면은 그리기만 한다. */
  async calendar(
    userId: string,
    petId: string,
    month?: string,
  ): Promise<ReservationCalendarResponse> {
    const pet = await this.requireOwnPet(userId, petId);
    const monthKey = month ?? this.currentMonthKey();
    const { year, month: monthOfYear } = this.parseMonth(monthKey);
    const today = startOfToday();

    const start = new Date(year, monthOfYear - 1, 1);
    // 반경계 구간이다. `lte: 말일` 로 쓰면 `@db.Date` 가 아닌 환경에서 그 날의 00:00
    // 이후가 잘려 **말일이 통째로 빠진다**(PetScheduleService 와 같은 이유).
    const end = new Date(year, monthOfYear, 1);

    const businessHours: BusinessHours | null = pet.tenant
      ? parseBusinessHours(pet.tenant.businessHours)
      : null;

    const [schedules, attendances, quota, closures] = await Promise.all([
      runWithoutTenant(() =>
        prisma.petSchedule.findMany({
          where: {
            petId,
            date: { gte: start, lt: end },
            ...this.scheduleRowFilter(pet.scheduleType),
          },
          select: { date: true, source: true },
        }),
      ),
      // 이미 등원 체크가 끝난 날은 취소할 수 없다 — 출석은 계획이 아니라 사실의 기록이고,
      // 그 날은 이미 이용권이 차감됐다.
      runWithoutTenant(() =>
        prisma.attendance.findMany({
          where: {
            petId,
            date: { gte: start, lt: end },
            status: { not: "SCHEDULED" },
          },
          select: { date: true },
        }),
      ),
      this.computeQuota(pet, today),
      // 임시 휴무일 (job-060). 요일 시간표로는 표현할 수 없는 하루라, 이걸 안 보면
      // **매장이 쉬는 날에 예약이 잡힌다.**
      pet.tenantId
        ? runWithTenant(pet.tenantId, () =>
            prisma.tenantClosure.findMany({
              where: { date: { gte: start, lt: end } },
              select: { date: true, reason: true },
            }),
          )
        : Promise.resolve([]),
    ]);

    const scheduleByDate = new Map(
      schedules.map((row) => [toDateKey(row.date), row.source]),
    );
    const attendedDates = new Set(
      attendances.map((row) => toDateKey(row.date)),
    );

    /**
     * 이 달의 **정기 등원일** (WEEKLY 요일 패턴에서 계산).
     *
     * 달력이 이걸 모르면 보호자에게 자기가 이미 매주 다니는 월·수·금이 **예약 가능한 날로
     * 보인다.** 그대로 예약하면 같은 날이 두 번 잡히고(요일 패턴 + GUARDIAN 행), 한도도
     * 두 번 깎인다. 그 아이는 이미 오는 날이므로 "이미 등원 예정"이 맞다.
     */
    const weeklyDates =
      pet.scheduleType === SCHEDULE_TYPE.WEEKLY
        ? new Set(datesOfWeekdaysInMonth(year, monthOfYear, pet.scheduleDays))
        : new Set<string>();

    // 사유까지 함께 든다 — 잠긴 날에 이유가 없으면 보호자는 매장에 전화한다.
    const closureByDate = new Map(
      closures.map((row) => [toDateKey(row.date), row.reason]),
    );

    const { balance, reservedAhead, remaining } = quota;

    const days: ReservationDay[] = [];
    for (
      let cursor = new Date(start);
      cursor < end;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const date = toDateKey(cursor);
      const source = scheduleByDate.get(date);
      // 정기 등원일도 "이미 등원 예정"이다 — 다만 보호자가 취소할 수 있는 예약은 아니다
      // (요일 패턴은 원장이 관리한다).
      const reserved = source !== undefined || weeklyDates.has(date);
      const attended = attendedDates.has(date);
      const open = isOpenOn(businessHours, cursor);
      const day = businessHours?.days.find(
        (item) => item.day === cursor.getDay(),
      );

      const closedTemporarily = closureByDate.has(date);

      days.push({
        date,
        // 임시 휴무면 요일 시간표가 뭐라 하든 그 날은 안 연다.
        open: open && !closedTemporarily,
        hours:
          open && !closedTemporarily && day ? formatBusinessDay(day) : null,
        reserved,
        // 원장이 넣은 날은 보호자가 지울 수 없고, 이미 등원한 날도 지울 수 없다.
        cancelable:
          source === SCHEDULE_SOURCE.GUARDIAN &&
          !attended &&
          fromDateKey(date) >= today,
        attended,
        blockedBy: this.blockReasonFor({
          date,
          today,
          reserved,
          open,
          closedTemporarily,
          hasTenant: Boolean(pet.tenant),
          hasBusinessHours: Boolean(businessHours),
          remaining,
          balance,
        }),
        closedReason: closedTemporarily
          ? (closureByDate.get(date) ?? null)
          : null,
      });
    }

    return {
      petId: pet.id,
      petName: pet.name,
      month: monthKey,
      tenant: pet.tenant
        ? {
            id: pet.tenant.id,
            name: pet.tenant.name,
            subdomain: pet.tenant.subdomain,
          }
        : null,
      businessHours,
      balance,
      reservedAhead,
      remaining,
      days,
    };
  }

  /**
   * 그 날짜를 왜 못 고르는지 — 없으면 `null`.
   *
   * ⚠️ 순서가 의미를 만든다. 지난 날짜인데 "이용권 없음"이라고 하면 보호자는 이용권을
   * 사고 나서야 그 날이 지났다는 걸 알게 된다. **고칠 수 없는 사유부터** 본다.
   */
  private blockReasonFor(params: {
    date: string;
    today: Date;
    reserved: boolean;
    /** 요일 시간표상 여는 날인가 (임시 휴무는 별도 인자다) */
    open: boolean;
    /** 그 날 하루만 쉬는가 (임시 휴무) */
    closedTemporarily: boolean;
    hasTenant: boolean;
    hasBusinessHours: boolean;
    remaining: number;
    /** 잔액 자체. `remaining` 이 0인 이유가 "잔액 0"인지 "이미 다 예정됨"인지 가른다. */
    balance: number;
  }): ReservationBlock | null {
    if (fromDateKey(params.date) < params.today) return RESERVATION_BLOCK.PAST;
    if (!params.hasTenant) return RESERVATION_BLOCK.NOT_ENROLLED;
    if (!params.hasBusinessHours) return RESERVATION_BLOCK.NO_BUSINESS_HOURS;
    if (params.reserved) return RESERVATION_BLOCK.ALREADY;
    // 임시 휴무를 정기 휴무보다 **먼저** 본다. 일요일에 임시 휴무를 걸었다면 사용자에게
    // 더 정확한 사실은 "원래 일요일은 쉰다" 쪽이지만, 매장이 굳이 그 날을 지정했다는 건
    // 사유를 적어 뒀다는 뜻이라 그 문구를 보여주는 편이 낫다.
    if (params.closedTemporarily) {
      return RESERVATION_BLOCK.TEMPORARILY_CLOSED;
    }
    if (!params.open) return RESERVATION_BLOCK.CLOSED;
    if (params.remaining <= 0) {
      // 이미 10회권을 산 사람에게 "이용권이 없습니다"라고 말하면 안 된다 — 그 사람이
      // 할 일은 충전이 아니라 예약 조정이다.
      return params.balance <= 0
        ? RESERVATION_BLOCK.NO_BALANCE
        : RESERVATION_BLOCK.SCHEDULE_FULL;
    }
    return null;
  }

  /**
   * 예약 추가. **하나라도 막히면 전부 거절한다.**
   *
   * 되는 것만 골라 넣고 성공으로 돌려주면, 보호자는 5일을 골랐는데 3일만 잡힌 걸 모른 채
   * 화면을 떠난다. 달력을 다시 열어 세어 보기 전까지는 드러나지 않고, 드러나는 시점은
   * 대개 아이를 데려간 날이다.
   */
  async create(userId: string, petId: string, dto: CreateReservationDto) {
    const pet = await this.requireOwnPet(userId, petId);

    if (!pet.tenant || !pet.tenantId) {
      throw new BadRequestException(
        RESERVATION_BLOCK_MESSAGE[RESERVATION_BLOCK.NOT_ENROLLED],
      );
    }
    if (!pet.tenant.isActive) {
      throw new BadRequestException(
        "유치원이 현재 운영을 중단한 상태라 예약할 수 없습니다.",
      );
    }

    const businessHours = parseBusinessHours(pet.tenant.businessHours);
    if (!businessHours) {
      throw new BadRequestException(
        RESERVATION_BLOCK_MESSAGE[RESERVATION_BLOCK.NO_BUSINESS_HOURS],
      );
    }

    // 같은 날짜를 두 번 보내면 한 번으로 친다 — 아니면 잔액 계산이 부풀려져 실제보다
    // 적게 예약할 수 있다고 판단한다.
    const dates = [...new Set(dto.dates)].sort();
    if (dates.length === 0) {
      throw new BadRequestException("예약할 날짜를 선택해주세요.");
    }

    const today = startOfToday();

    // ── 날짜별 사유 검사 (잔액을 제외한 것들) ────────────────────────────
    const existing = await runWithoutTenant(() =>
      prisma.petSchedule.findMany({
        where: {
          petId,
          date: { in: dates.map(fromDateKey) },
          ...this.scheduleRowFilter(pet.scheduleType),
        },
        select: { date: true },
      }),
    );
    const existingKeys = new Set(existing.map((row) => toDateKey(row.date)));

    // 정기 등원일도 "이미 등원 예정"이다 (job-060). 이 검사가 없으면 보호자가 자기가
    // 매주 다니는 월·수·금을 다시 예약해 같은 날이 두 번 잡힌다.
    const weekdays =
      pet.scheduleType === SCHEDULE_TYPE.WEEKLY ? pet.scheduleDays : [];

    // 임시 휴무일 (job-060). 화면도 막지만 **서버가 마지막 방어선**이다 — 달력을 열어
    // 둔 사이에 매장이 그 날을 휴무로 지정했을 수 있고, 그러면 화면의 판정은 이미 낡았다.
    const closures = await runWithTenant(pet.tenantId, () =>
      prisma.tenantClosure.findMany({
        where: { date: { in: dates.map(fromDateKey) } },
        select: { date: true },
      }),
    );
    const closedKeys = new Set(closures.map((row) => toDateKey(row.date)));

    for (const date of dates) {
      const isWeeklyDay = weekdays.includes(fromDateKey(date).getDay());
      const reason = this.blockReasonFor({
        date,
        today,
        reserved: existingKeys.has(date) || isWeeklyDay,
        open: isOpenOn(businessHours, fromDateKey(date)),
        closedTemporarily: closedKeys.has(date),
        hasTenant: true,
        hasBusinessHours: true,
        // 잔액은 개수 단위라 날짜 하나씩 볼 수 없다. 아래에서 한꺼번에 본다.
        remaining: 1,
        balance: 1,
      });
      if (reason) {
        throw new BadRequestException(
          `${date}: ${RESERVATION_BLOCK_MESSAGE[reason]}`,
        );
      }
    }

    // ── 한도 검사 ────────────────────────────────────────────────────────
    // ⚠️ 잔액이 아니라 **잔액 − 앞으로의 등원 예정일** 과 비교한다(정기 등원일 포함).
    // 잔액만 보면 10회권으로 이번 주에 10일, 다음 주에 또 10일을 잡을 수 있다.
    const { balance, remaining } = await this.computeQuota(pet, today);

    if (dates.length > remaining) {
      throw new BadRequestException(
        remaining === 0
          ? RESERVATION_BLOCK_MESSAGE[
              balance <= 0
                ? RESERVATION_BLOCK.NO_BALANCE
                : RESERVATION_BLOCK.SCHEDULE_FULL
            ]
          : `남은 이용권으로는 ${remaining}일까지 예약할 수 있습니다. (선택: ${dates.length}일)`,
      );
    }

    // ── 저장 ─────────────────────────────────────────────────────────────
    // 쓰기는 아이가 속한 매장을 **명시해서** 연다. 보호자는 개인 스코프라 활성 테넌트가
    // 없는데 `PetSchedule.tenantId` 는 NOT NULL 이고, 들어갈 곳은 아이가 등록된 매장
    // 하나뿐이다. `runWithoutTenant` 로 쓰면 Extension 이 스코프를 못 걸어 다른 매장
    // 아이에게도 쓸 수 있는 코드가 되므로 그렇게 하지 않는다.
    const tenantId = pet.tenantId;
    await runWithTenant(tenantId, () =>
      prisma.$transaction(async (tx) => {
        // ⚠️ WEEKLY 아이에게 남아 있는 `ADMIN` 행을 먼저 치운다.
        //
        // 그 행들은 `scheduledOn` 이 무시하므로 **아무 효력이 없다**(MONTHLY→WEEKLY 로
        // 방식을 바꿨을 때 지워지지 않고 남은 것들이다). 그런데 `@@unique([petId, date])`
        // 는 살아 있어서, 그대로 두면 아래 `skipDuplicates` 가 보호자의 예약을 조용히
        // 건너뛴다 — 화면에는 "예약 완료"가 뜨는데 그 날 출석부에는 아이가 없다.
        // 효력 없는 행을 효력 있는 행으로 바꾸는 것이므로 잃는 것이 없다.
        if (pet.scheduleType === SCHEDULE_TYPE.WEEKLY) {
          await tx.petSchedule.deleteMany({
            where: {
              petId,
              date: { in: dates.map(fromDateKey) },
              source: SCHEDULE_SOURCE.ADMIN,
            },
          });
        }

        await tx.petSchedule.createMany({
          data: dates.map((date) => ({
            tenantId,
            petId,
            date: fromDateKey(date),
            source: SCHEDULE_SOURCE.GUARDIAN,
          })),
          // 검사와 저장 사이에 원장이 같은 날을 넣었을 수 있다. `@@unique([petId, date])`
          // 라 그 경우 전체가 실패하는데, 결과적으로 그 날은 이미 등원 예정이므로
          // 보호자의 의도는 이미 이뤄진 셈이다 — 건너뛰고 성공으로 둔다.
          skipDuplicates: true,
        });
      }),
    );

    // 오늘을 예약했으면 그 자리에서 출석 예정 행을 만든다 — 없으면 원장의 오늘 출석부에
    // 그 아이가 뜨지 않아, 보호자는 예약했는데 매장은 모르는 상태가 된다 (job-053).
    if (dates.includes(toDateKey(today))) {
      await runWithTenant(tenantId, () =>
        ensureScheduledAttendance([petId], today),
      );
    }

    return {
      created: dates,
      remaining: Math.max(0, remaining - dates.length),
    };
  }

  /**
   * 예약 취소 — **보호자가 잡은 미래의 예약만** 지운다.
   *
   * 원장이 짜 넣은 등원일은 지우지 않는다(매장 운영 계획이 말없이 바뀐다). 이미 등원
   * 체크가 끝난 날도 지우지 않는다 — 출석은 계획이 아니라 사실의 기록이고, 그 날은 이미
   * 이용권이 차감됐다. `Attendance` 행은 건드리지 않는다: 예정(SCHEDULED)으로 남아도
   * 사실을 왜곡하지 않지만, 지웠는데 그 아이가 실제로 오면 기록할 자리가 사라진다.
   */
  async cancel(userId: string, petId: string, date: string) {
    await this.requireOwnPet(userId, petId);

    const target = fromDateKey(date);
    if (target < startOfToday()) {
      throw new BadRequestException("지난 날짜의 예약은 취소할 수 없습니다.");
    }

    const attended = await runWithoutTenant(() =>
      prisma.attendance.findFirst({
        where: { petId, date: target, status: { not: "SCHEDULED" } },
        select: { id: true },
      }),
    );
    if (attended) {
      throw new BadRequestException(
        "이미 등원한 날은 취소할 수 없습니다. 유치원에 문의해주세요.",
      );
    }

    const schedule = await runWithoutTenant(() =>
      prisma.petSchedule.findFirst({
        where: { petId, date: target },
        select: { id: true, source: true },
      }),
    );
    if (!schedule) {
      throw new NotFoundException("예약 내역이 없습니다.");
    }
    if (schedule.source !== SCHEDULE_SOURCE.GUARDIAN) {
      throw new BadRequestException(
        "유치원이 지정한 등원일은 직접 취소할 수 없습니다. 유치원에 문의해주세요.",
      );
    }

    await runWithoutTenant(() =>
      prisma.petSchedule.delete({ where: { id: schedule.id } }),
    );

    return { canceled: date };
  }
}
