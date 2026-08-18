import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, requireTenantId } from "@pawlog/database";
import {
  SCHEDULE_SOURCE,
  SCHEDULE_TYPE,
  datesOfWeekdaysInMonth,
  fromDateKey,
  toDateKey,
} from "@pawlog/shared";
import type { PetScheduleResponse } from "@pawlog/shared";

import { ensureScheduledAttendance, startOfToday } from "../../shared/utils";
import { UpdatePetScheduleDto } from "../dtos";

/**
 * 등원 스케줄 (job-053).
 *
 * ## 두 방식이 필요한 이유
 *
 * 유치원 원생은 두 부류가 실제로 섞여 있다. 주 3회 정기권 아이는 매달 같은 요일에 오고,
 * 파트타임 아이는 다음 주 일정이 그때그때 정해져 **요일 패턴 자체가 없다.** 하나로
 * 강제하면 둘 중 한쪽이 반드시 앱 밖(수첩·단톡방)으로 나가고, 앱 밖으로 나간 등원일은
 * 알림장·이용권 차감과 영영 연결되지 않는다.
 *
 *   WEEKLY  `Pet.scheduleDays` 가 진실. 달이 바뀌어도 이어진다
 *   MONTHLY `PetSchedule` 행이 진실. 다음 달은 비어 있고 원장이 다시 짠다
 *
 * ## 요일 패턴을 날짜로 펼쳐 저장하지 않는다
 *
 * WEEKLY 를 미리 `PetSchedule` 행으로 펼쳐 두면 ① 패턴을 고칠 때마다 미래 행을 다시
 * 써야 하고 ② 펼치는 작업이 한 번 밀리면 그 달 출석부가 조용히 빈다. 반복은 반복인
 * 채로 두면 어긋날 수가 없다 — 아래 `list()` 가 WEEKLY 의 날짜를 **계산해서** 내려주는
 * 것도 같은 이유다(그 응답은 저장물이 아니라 미리보기다).
 *
 * ## 편집 단위가 한 달인 이유
 *
 * 달력 화면이 한 번에 보여주는 것이 한 달이다. 페이로드에 날짜 배열만 받고 `month` 를
 * 안 받으면 "8월을 고치는 요청"과 "전체를 이걸로 바꾸는 요청"을 구분할 수 없어, 8월을
 * 저장하는 순간 9월 예정일이 사라진다.
 */
@Injectable()
export class PetScheduleService {
  /** `"YYYY-MM"` → { year, month }. DTO 에서 형식은 이미 검증됐다. */
  private parseMonth(month: string) {
    const [year, monthOfYear] = month.split("-").map(Number);
    return { year: year, month: monthOfYear };
  }

  private currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
  }

  /**
   * 이 매장의 원생인지 확인한다.
   *
   * Prisma Extension 이 `tenantId` 를 주입하므로 다른 매장 아이는 애초에 조회되지 않지만,
   * 그때 나오는 것이 `null` 이라 **404 로 바꿔 주는 쪽이 이 서비스의 책임**이다.
   */
  private async requirePet(id: string) {
    const pet = await prisma.pet.findUnique({
      where: { id },
      select: { id: true, scheduleType: true, scheduleDays: true },
    });
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }
    return pet;
  }

  /**
   * 그 달의 등원 예정일. WEEKLY 는 계산값, MONTHLY 는 저장된 행이다.
   *
   * ⚠️ 어느 쪽이든 **보호자가 잡은 예약(job-060)을 함께 싣는다.** 빼면 원장의 달력이
   * 실제 등원 예정과 달라지는데, 그 차이는 출석부에서만 드러난다 — 예약한 아이가
   * 아침에 나타나고 원장은 왜 왔는지 모른다.
   */
  async list(id: string, month?: string): Promise<PetScheduleResponse> {
    const pet = await this.requirePet(id);
    const monthKey = month ?? this.currentMonthKey();
    const { year, month: monthOfYear } = this.parseMonth(monthKey);

    // 반경계 구간이다. `lte: 말일` 로 쓰면 `@db.Date` 가 아닌 환경에서 그 날의
    // 00:00 이후가 잘려 **말일이 통째로 빠진다.**
    const range = {
      gte: new Date(year, monthOfYear - 1, 1),
      lt: new Date(year, monthOfYear, 1),
    };

    // WEEKLY 아이에게는 요일 계산값 + 보호자 예약이 곧 그 달의 등원일이다. MONTHLY
    // 아이는 저장된 행이 전부이므로 아래 조회 하나로 둘 다 들어온다.
    const rows = await prisma.petSchedule.findMany({
      where: {
        petId: id,
        date: range,
        ...(pet.scheduleType === SCHEDULE_TYPE.WEEKLY
          ? { source: SCHEDULE_SOURCE.GUARDIAN }
          : {}),
      },
      orderBy: { date: "asc" },
      select: { date: true },
    });

    const stored = rows.map((row) => toDateKey(row.date));
    const computed =
      pet.scheduleType === SCHEDULE_TYPE.WEEKLY
        ? datesOfWeekdaysInMonth(year, monthOfYear, pet.scheduleDays)
        : [];

    return {
      scheduleType: pet.scheduleType,
      scheduleDays: pet.scheduleDays,
      month: monthKey,
      // 요일 계산값과 보호자 예약이 같은 날을 가리킬 수 있다(정기 요일에 또 예약).
      dates: [...new Set([...computed, ...stored])].sort(),
    };
  }

  /**
   * 저장한 스케줄에 오늘이 포함되면 **그 자리에서** 오늘의 출석 예정 행을 만든다 (job-053).
   *
   * 이게 없으면 원장이 원생 카드에서 "오늘"로 날짜를 지정해도 등원 버튼이 나타나지 않는다 —
   * 출석 행을 만드는 곳이 `GET v1/attendances/today` 하나뿐이라, 출석부 화면을 한 번 갔다
   * 와야만 비로소 목록에 뜬다. "오늘 온다고 방금 지정했는데 등원 체크를 못 하는" 상태다.
   *
   * 반대 방향(오늘을 스케줄에서 뺐을 때)은 **지우지 않는다.** 이미 등원 체크를 했다면 그
   * 기록까지 사라지고, 출석은 계획이 아니라 사실의 기록이기 때문이다.
   */
  private async syncTodayAttendance(petId: string, scheduledToday: boolean) {
    if (!scheduledToday) return;
    await ensureScheduledAttendance([petId], startOfToday());
  }

  /** 방식 전환 + (MONTHLY 면) 그 달의 등원일 교체. */
  async update(id: string, dto: UpdatePetScheduleDto) {
    await this.requirePet(id);
    const today = startOfToday();

    if (dto.scheduleType === SCHEDULE_TYPE.WEEKLY) {
      const updated = await prisma.pet.update({
        where: { id },
        data: {
          scheduleType: SCHEDULE_TYPE.WEEKLY,
          // 미전달과 빈 배열을 구분한다 — 빈 배열은 "등원일 없음"이라는 명시적 선택이다.
          ...(dto.scheduleDays !== undefined
            ? { scheduleDays: dto.scheduleDays }
            : {}),
        },
        select: { scheduleDays: true },
      });

      await this.syncTodayAttendance(
        id,
        updated.scheduleDays.includes(today.getDay()),
      );
      return this.list(id, dto.month);
    }

    // ── MONTHLY ──────────────────────────────────────────────────────────
    if (!dto.month) {
      throw new BadRequestException(
        "날짜 지정 방식은 교체 대상 달(month)이 필요합니다.",
      );
    }

    const { year, month: monthOfYear } = this.parseMonth(dto.month);
    const start = new Date(year, monthOfYear - 1, 1);
    const end = new Date(year, monthOfYear, 1);
    const dates = dto.dates ?? [];

    // 다른 달의 날짜가 섞여 오면 조용히 무시하지 않고 막는다. 무시하면 원장은
    // 저장됐다고 믿는데 그 날은 출석부에 영영 뜨지 않는다.
    const outOfRange = dates.filter((date) => !date.startsWith(dto.month!));
    if (outOfRange.length > 0) {
      throw new BadRequestException(
        `${dto.month} 이외의 날짜가 포함되어 있습니다: ${outOfRange.join(", ")}`,
      );
    }

    // 지난 날짜는 예정일로 지정할 수 없다. 화면에서도 막지만 서버가 마지막 방어선이다 —
    // API 를 직접 부르는 경로(스크립트·연동)로 들어오면 "지나간 날에 올 예정"이라는
    // 모순된 행이 쌓이고, 그건 아무 화면에도 뜨지 않아 발견되지 않는다.
    const past = dates.filter((date) => fromDateKey(date) < today);
    if (past.length > 0) {
      throw new BadRequestException(
        `지난 날짜는 등원일로 지정할 수 없습니다: ${past.join(", ")}`,
      );
    }

    const tenantId = requireTenantId();

    // ⚠️ 교체 범위를 **오늘 이후로 자른다.** 이번 달을 저장할 때 범위를 1일부터 잡으면
    // 이미 지나간 예정일(1~6일)이 함께 지워지는데, 화면은 지난 날짜를 보내지 않으므로
    // 저장 한 번에 그 달의 앞부분 계획이 통째로 증발한다. 지난 것은 손대지 않는다.
    const replaceFrom = start > today ? start : today;

    // 지우고 넣는 사이에 출석부가 그 달을 읽으면 비어 보이므로 한 트랜잭션으로 묶는다.
    await prisma.$transaction([
      prisma.petSchedule.deleteMany({
        where: {
          petId: id,
          date: { gte: replaceFrom, lt: end },
          // ⚠️ **보호자가 잡은 예약은 지우지 않는다** (job-060). 이 화면이 교체하는 것은
          // 원장이 짠 등원일뿐이다. 범위로만 지우면 원장이 8월 달력을 한 번 저장하는
          // 순간 그 달의 보호자 예약이 통째로 사라지는데, 보호자에게는 아무 알림도 가지
          // 않아 아이를 데려온 날에야 드러난다.
          source: SCHEDULE_SOURCE.ADMIN,
        },
      }),
      prisma.petSchedule.createMany({
        data: dates.map((date) => ({
          tenantId,
          petId: id,
          // `new Date("2026-08-07")` 은 UTC 로 파싱돼 KST 에서 하루가 밀린다.
          date: fromDateKey(date),
          source: SCHEDULE_SOURCE.ADMIN,
        })),
        // 보호자가 이미 예약한 날을 원장이 함께 고르면 여기서 건너뛴다. 그 날은
        // GUARDIAN 행으로 남지만 "이 아이가 이 날 온다"는 사실은 같으므로 결과가 맞다.
        skipDuplicates: true,
      }),
      prisma.pet.update({
        where: { id },
        data: { scheduleType: SCHEDULE_TYPE.MONTHLY },
      }),
    ]);

    await this.syncTodayAttendance(id, dates.includes(toDateKey(today)));
    return this.list(id, dto.month);
  }
}
