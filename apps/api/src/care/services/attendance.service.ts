import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  prisma,
  requireTenantId,
  runWithoutTenant,
  tenantTransaction,
} from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import {
  ensureScheduledAttendance,
  scheduledOn,
  startOfToday,
} from "../../shared/utils";
import { SubscriptionLedgerService } from "../../subscription/services/subscription-ledger.service";
import {
  CheckInAttendanceDto,
  CheckOutAttendanceDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  UpdateAttendanceStatusDto,
} from "../dtos";
import { GuardianNotificationService } from "./guardian-notification.service";

const ATTENDANCE_SORTABLE_FIELDS = ["createdAt", "date"] as const;
const ALLOWED_STATUS_TRANSITIONS = ["ABSENT", "MAKEUP", "CANCELED"] as const;

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly subscriptionLedgerService: SubscriptionLedgerService,
    private readonly guardianNotificationService: GuardianNotificationService,
  ) {}

  /**
   * 이용권 차감 (job-045).
   *
   * 원장(ledger)이 **아이 단위**가 되면서 계정 유무를 따질 이유가 사라졌다 — 예전에는
   * 회원 기준이라 계정 없는 원생을 통째로 건너뛰었고, 도입 첫날 원생 전원이 그 상태여서
   * 회수권이 한 번도 차감되지 않았다. 잔액 없음/무제한 요금제 처리는 원장 서비스가 한다.
   */
  private async deduct(params: {
    petId: string;
    userId: string | null;
    attendanceId: string;
    description: string;
  }) {
    await this.subscriptionLedgerService.deductForAttendance(params);
  }

  /** 출석 기록 등록 */
  async create(dto: CreateAttendanceDto) {
    const pet = await prisma.pet.findUnique({ where: { id: dto.petId } });
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }

    const attendance = await prisma.attendance.create({
      data: {
        tenantId: requireTenantId(),
        petId: dto.petId,
        date: new Date(dto.date),
        status: dto.status,
      },
    });
    return { attendance };
  }

  /** 출석 기록 목록 (petId 필터 + 페이지네이션·정렬) */
  async findAll(query: PaginationQuery & { petId?: string }) {
    const { page, pageSize, skip, take, order, sort } =
      resolvePagination(query);

    const where = query.petId ? { petId: query.petId } : {};

    const sortField = ATTENDANCE_SORTABLE_FIELDS.includes(
      sort as (typeof ATTENDANCE_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "date";

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.attendance.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
      });
      const total = await tx.attendance.count({ where });
      return [items, total] as const;
    });

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /**
   * 오늘의 출석부 조회.
   *
   * 오늘 등원 예정인 이용중 펫(job-053: 요일 반복 + 날짜 지정 두 방식)에 대해 출석 기록이
   * 없으면 SCHEDULED 상태로 자동 생성한 뒤, 오늘 날짜의 출석부를 페이지네이션으로 반환한다.
   *
   * 생성이 조회 시점에 일어나는 것은 의도다 — 크론으로 미리 만들면 그 작업이 한 번 밀렸을
   * 때 그날 출석부가 통째로 비고, 원장은 "오늘 아무도 안 온다"로 읽는다.
   */
  async findToday(query: PaginationQuery) {
    const { page, pageSize, skip, take, order } = resolvePagination(query);

    const today = startOfToday();

    const scheduledPets = await prisma.pet.findMany({
      where: { status: "ACTIVE", ...scheduledOn(today) },
      select: { id: true },
    });

    await ensureScheduledAttendance(
      scheduledPets.map(({ id }) => id),
      today,
    );

    const where = { date: today };
    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.attendance.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: order },
        include: {
          pet: { select: { id: true, name: true, profileImageFileId: true } },
        },
      });
      const total = await tx.attendance.count({ where });
      return [items, total] as const;
    });

    // job-063: 이용권 잔여를 함께 싣는다. 출석부가 등원 버튼을 누르는 주된 화면인데,
    // 잔액이 없으면 화면이 그 사실을 말할 수 없어 **조용히 미차감으로 지나간다.**
    //
    // ⚠️ 아이마다 부르면 페이지당 N+1 이다. 원생 목록과 같은 방식으로 한 번에 뽑는다 —
    // `distinct` 는 `orderBy` 의 **첫 필드와 같아야** Postgres DISTINCT ON 으로 내려간다.
    const petIds = [...new Set(items.map((item) => item.petId))];
    const latestLedgers = petIds.length
      ? await tenantTransaction(prisma, (tx) =>
          tx.subscriptionLedger.findMany({
            where: { petId: { in: petIds } },
            orderBy: [{ petId: "asc" }, { createdAt: "desc" }],
            distinct: ["petId"],
            select: { petId: true, balanceAfter: true },
          }),
        )
      : [];
    const balanceByPet = new Map(
      latestLedgers.map((row) => [row.petId, row.balanceAfter]),
    );

    return buildPaginatedData(
      items.map((item) => ({
        ...item,
        // `null` 은 "이용권을 판 적이 없음"이고 `0` 은 "다 써서 없음"이다. 합치면 원장이
        // 충전이 필요한 아이와 아직 안 판 아이를 구분할 수 없다(원생 목록과 같은 규칙).
        passRemaining: balanceByPet.get(item.petId) ?? null,
      })),
      { page, pageSize, total },
    );
  }

  /**
   * 보호자 - 내 아이의 등원 이력 (job-046).
   *
   * 회수권을 파는 서비스인데 보호자가 "이번 달 몇 번 갔지"를 볼 수 없었다. 알림장은 보는데
   * 출석은 못 보는 상태라, 잔여 횟수가 맞는지 확인할 방법이 아예 없었다.
   *
   * 소유 검사는 **아이 기준**이다 — 매장 스코프가 아니라 "내 아이인가"가 기준이므로,
   * 여러 매장에 아이를 맡긴 보호자도 한 번에 볼 수 있게 bypass 컨텍스트에서 조회한다.
   */
  async findAllForOwner(
    userId: string,
    query: PaginationQuery & { petId?: string },
  ) {
    const { page, pageSize, skip, take, order } = resolvePagination(query);

    const myPets = await runWithoutTenant(() =>
      prisma.pet.findMany({ where: { userId }, select: { id: true } }),
    );
    const petIds = myPets.map((pet) => pet.id);
    // 남의 아이 id 를 넣어도 내 아이 목록으로 교집합을 잡아 걸러진다.
    const targetIds = query.petId
      ? petIds.filter((id) => id === query.petId)
      : petIds;

    if (targetIds.length === 0) {
      return buildPaginatedData([], { page, pageSize, total: 0 });
    }

    const where = { petId: { in: targetIds } };
    const [items, total] = await runWithoutTenant(() =>
      prisma.$transaction(async (tx) => {
        const items = await tx.attendance.findMany({
          where,
          skip,
          take,
          orderBy: { date: order },
          include: {
            pet: { select: { id: true, name: true, profileImageFileId: true } },
          },
        });
        const total = await tx.attendance.count({ where });
        return [items, total] as const;
      }),
    );

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 출석 기록 상세 조회 */
  async findOne(id: string) {
    const attendance = await prisma.attendance.findUnique({ where: { id } });
    if (!attendance) {
      throw new NotFoundException("존재하지 않는 출석 기록입니다.");
    }
    return { attendance };
  }

  /** id 로 출석 기록 + 소속 펫(보호자 userId)을 함께 조회 (내부 전용) */
  private async findOneWithPet(id: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { pet: { select: { id: true, userId: true } } },
    });
    if (!attendance) {
      throw new NotFoundException("존재하지 않는 출석 기록입니다.");
    }
    return attendance;
  }

  /** 등원 체크 */
  async checkIn(id: string, dto: CheckInAttendanceDto) {
    const attendance = await this.findOneWithPet(id);

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        status: "CHECKED_IN",
        checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : new Date(),
      },
    });

    if (dto.deductSubscription ?? true) {
      await this.deduct({
        userId: attendance.pet.userId,
        petId: attendance.pet.id,
        attendanceId: attendance.id,
        description: "등원 체크에 따른 정기권/회수권 차감",
      });
    }

    await this.guardianNotificationService.trigger("CHECK_IN", {
      petId: attendance.pet.id,
      attendanceId: attendance.id,
      userId: attendance.pet.userId,
    });

    return { attendance: updated };
  }

  /**
   * 등원 되돌리기 (job-052, design-system.md §3.2).
   *
   * ## 왜 서버 동작인가
   *
   * 이 앱의 오터치 대책은 막는 것이 아니라 **되돌리는 것**이다(젖은 손 전제라 확인
   * 다이얼로그를 붙이면 하루 20번 반복되는 등하원 체크가 전부 2탭이 되고, 결국 앱 밖에서
   * 처리하게 된다). 그런데 등원 체크는 화면 상태만 바꾸지 않는다 —
   *
   *   1. 회수권을 1회 깎고
   *   2. 보호자에게 알림톡을 보낸다
   *
   * 프런트에서 상태만 되돌리면 1번이 그대로 남아 **오터치 한 번에 보호자가 1회를 잃는다.**
   * 그래서 되돌리기는 반드시 서버가 한다.
   *
   * ## 알림톡은 되돌릴 수 없다
   *
   * 이미 나간 메시지는 회수할 방법이 없다. 그래서 `guardianNotified` 를 함께 돌려주고
   * 화면이 "보호자에게는 이미 등원 알림이 나갔습니다"라고 밝힌다 — 조용히 넘어가면
   * 원장은 알림이 안 갔다고 믿고, 보호자 문의에 답을 못 한다.
   */
  async undoCheckIn(id: string) {
    const attendance = await this.findOne(id);

    if (attendance.attendance.status !== "CHECKED_IN") {
      throw new BadRequestException(
        "등원 상태가 아니어서 되돌릴 수 없습니다. 이미 하원 처리했거나 상태가 변경되었습니다.",
      );
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: { status: "SCHEDULED", checkInAt: null },
    });

    await this.subscriptionLedgerService.revertForAttendance(id);

    return { attendance: updated, guardianNotified: true };
  }

  /** 하원 체크 */
  async checkOut(id: string, dto: CheckOutAttendanceDto) {
    const attendance = await this.findOneWithPet(id);

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        status: "CHECKED_OUT",
        checkOutAt: dto.checkOutAt ? new Date(dto.checkOutAt) : new Date(),
      },
    });

    if (dto.deductSubscription) {
      await this.deduct({
        userId: attendance.pet.userId,
        petId: attendance.pet.id,
        attendanceId: attendance.id,
        description: "하원 체크에 따른 정기권/회수권 차감",
      });
    }

    await this.guardianNotificationService.trigger("CHECK_OUT", {
      petId: attendance.pet.id,
      attendanceId: attendance.id,
      userId: attendance.pet.userId,
    });

    return { attendance: updated };
  }

  /** 결석/보강/취소 처리 + 정기권 차감 여부 선택 */
  async updateStatus(id: string, dto: UpdateAttendanceStatusDto) {
    if (
      !ALLOWED_STATUS_TRANSITIONS.includes(
        dto.status as (typeof ALLOWED_STATUS_TRANSITIONS)[number],
      )
    ) {
      throw new BadRequestException(
        "결석(ABSENT), 보강(MAKEUP), 취소(CANCELED) 상태만 처리할 수 있습니다.",
      );
    }

    const attendance = await this.findOneWithPet(id);

    const updated = await prisma.attendance.update({
      where: { id },
      data: { status: dto.status },
    });

    if (dto.deductSubscription) {
      await this.deduct({
        userId: attendance.pet.userId,
        petId: attendance.pet.id,
        attendanceId: attendance.id,
        description: dto.reason
          ? `${dto.status} 처리 (${dto.reason})`
          : `${dto.status} 처리에 따른 정기권/회수권 차감`,
      });
    }

    await this.guardianNotificationService.trigger(
      dto.status === "MAKEUP" ? "MAKEUP" : "ABSENT",
      {
        petId: attendance.pet.id,
        attendanceId: attendance.id,
        userId: attendance.pet.userId,
        reason: dto.reason,
      },
    );

    return { attendance: updated };
  }

  /** 출석 기록 수정 (등/하원 시각·상태) */
  async update(id: string, dto: UpdateAttendanceDto) {
    await this.findOne(id);

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        status: dto.status,
        checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : undefined,
        checkOutAt: dto.checkOutAt ? new Date(dto.checkOutAt) : undefined,
      },
    });
    return { attendance };
  }

  /** 출석 기록 삭제 */
  async remove(id: string) {
    await this.findOne(id);
    await prisma.attendance.delete({ where: { id } });
    return { id };
  }
}
