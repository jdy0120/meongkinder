import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  prisma,
  requireTenantId,
  runWithoutTenant,
  tenantTransaction,
} from "@pawlog/database";
import {
  BADGE_LEVEL,
  buildPaginatedData,
  MEMBERSHIP_STATUS,
  resolvePagination,
  resolvePetSafetyLevel,
  type PaginationQuery,
} from "@pawlog/shared";
import {
  cleanPhone,
  promotePetPhoto,
  toPickupPersonsJson,
  toVaccinationsJson,
} from "../../pet/services/pet.service";
import { FileService } from "../../shared/file/services/file.service";
import { startOfToday } from "../../shared/utils";
import type { UpdatePetDto } from "../../pet/dtos";
import type { AdminCreatePetDto } from "../dtos";

const PET_SORTABLE_FIELDS = [
  "createdAt",
  "name",
  "species",
  // job-052: 원생 목록의 **기본 정렬**. 유치원은 등하원 시각이 제각각이고 15~18시가
  // 가장 혼잡해서, 픽업 시각 순 목록이 그대로 오후 작업 순서표가 된다.
  "pickupTime",
] as const;

/**
 * 원생 목록 기본 정렬 (job-052, design-system.md §6.1).
 *
 * 이름순이 아니다 — 이름으로 찾는 일은 검색창이 대체하고, 원장이 목록을 위아래로 훑는
 * 실제 이유는 "지금 누가 올 차례인가"다. 픽업 시각을 아직 안 넣은 아이는 Postgres 의
 * ASC 기본값(NULLS LAST)으로 뒤에 붙는다.
 *
 * 기본값을 서버에 두는 이유: 화면이 매번 `sort=pickupTime` 을 붙이는 방식이면 새 화면이
 * 하나 생길 때마다 빠뜨릴 수 있고, 그때 목록은 조용히 등록순으로 돌아간다.
 */
const PET_DEFAULT_SORT = "pickupTime";

/** 원생 목록·필터 개수가 공유하는 대상 조건. 둘이 달라지면 칩 숫자와 목록이 어긋난다. */
const PET_ACTIVE_STATUS = "ACTIVE";

@Injectable()
export class AdminService {
  constructor(private readonly fileService: FileService) {}

  /**
   * 구독 목록 (페이지네이션·정렬·검색).
   * job-020 부터 구독 주체가 User -> Tenant 로 이동해 검색 기준도 테넌트명/서브도메인으로 변경됨.
   */
  async listSubscriptions(query: PaginationQuery) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = search
      ? {
          tenant: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              {
                subdomain: { contains: search, mode: "insensitive" as const },
              },
            ],
          },
        }
      : {};

    const sortField = [
      "createdAt",
      "startDate",
      "endDate",
      "nextPaymentDate",
    ].includes(sort as string)
      ? (sort as string)
      : "createdAt";

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.tenantSubscription.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: {
          tenant: {
            select: {
              name: true,
              subdomain: true,
            },
          },
          plan: true,
        },
      });
      const total = await tx.tenantSubscription.count({ where });
      return [items, total] as const;
    });

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 반려동물(원생) 목록 — 전체 사용자 대상, 보호자 정보 포함 (페이지네이션·정렬·검색) */
  async listPets(query: PaginationQuery) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = {
      // job-052: **이용중인 원생만.** 필터 칩의 개수(`getPetSummary`)도 같은 조건을 쓴다 —
      // 한쪽만 걸어 두면 "전체 18"이라고 써 놓고 목록에는 19마리가 나오는 상태가 되고,
      // 사용자는 그걸 버그로 인식하지 못한 채 목록 전체를 못 믿게 된다.
      // (등록 해지한 아이는 매일 보는 작업 목록에 있을 이유도 없다.)
      status: PET_ACTIVE_STATUS,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              {
                user: {
                  OR: [
                    {
                      email: { contains: search, mode: "insensitive" as const },
                    },
                    {
                      nickname: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const sortField = PET_SORTABLE_FIELDS.includes(
      sort as (typeof PET_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : PET_DEFAULT_SORT;

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.pet.findMany({
        where,
        skip,
        take,
        // 픽업 시각이 같은 아이가 여럿이면(셔틀 같은 호차) 순서가 요청마다 흔들려
        // 페이지네이션에서 같은 아이가 두 번 나오거나 빠진다. 이름으로 고정한다.
        orderBy: [{ [sortField]: order }, { name: "asc" }],
        include: {
          user: { select: { email: true, nickname: true } },
          // job-052: **오늘의 출석**을 함께 싣는다.
          //
          // 원생 목록의 필터 칩이 "등원 중 / 등원 예정 / 하원 완료 / 주의"인데
          // (design-system.md §6.1), 앞의 셋은 전부 오늘의 출석 상태다. 화면이 목록과
          // 출석부를 각각 불러 클라이언트에서 맞추면 두 응답의 페이지가 어긋나
          // 20번째 아이의 상태가 비거나 남의 것이 붙는다.
          //
          // 등원 처리 버튼도 이 `id` 가 있어야 누를 수 있다 — 없으면 카드에서 바로
          // 처리하지 못하고 출석부 화면으로 넘어가야 한다.
          attendances: {
            where: { date: startOfToday() },
            take: 1,
            select: {
              id: true,
              status: true,
              checkInAt: true,
              checkOutAt: true,
            },
          },
        },
      });
      const total = await tx.pet.count({ where });
      return [items, total] as const;
    });

    // 정기권 잔여 (job-052). 원장(ledger)은 append-only 라 "마지막 줄의 balanceAfter"가
    // 곧 현재 잔액이다. 아이마다 한 번씩 부르면 페이지당 N+1 쿼리가 되므로 한 번에 뽑는다.
    //
    // ⚠️ `distinct` 는 `orderBy` 의 **첫 필드와 같아야** Postgres DISTINCT ON 으로 내려간다.
    // 순서를 바꾸면 조용히 "아무 줄이나 한 줄"이 되어 잔액이 과거 값으로 보인다.
    const latestLedgers = items.length
      ? await tenantTransaction(prisma, (tx) =>
          tx.subscriptionLedger.findMany({
            where: { petId: { in: items.map((pet) => pet.id) } },
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
      items.map((pet) => ({
        ...pet,
        // 이용권을 판 적이 없는 아이는 `null` 이다 — 0회(다 써서 없음)와 구분해야
        // 원장이 "충전이 필요한 아이"와 "아직 안 판 아이"를 다르게 대할 수 있다.
        passRemaining: balanceByPet.get(pet.id) ?? null,
      })),
      { page, pageSize, total },
    );
  }

  /**
   * 원생 목록 필터 칩의 개수 (job-052, design-system.md §6.1).
   *
   * 목록 응답에서 세지 않는 이유는 페이지네이션이다 — "이 페이지의 등원 중 3마리"는
   * 필터로서 의미가 없다. 매장 전체 기준이어야 눌러 볼 가치가 있다.
   *
   * "주의"는 SQL 로 셀 수 없다. 접종 만료 판정이 JSON 컬럼 안의 날짜를 오늘과 비교하는
   * 일이라 인덱스도 못 타고, 무엇보다 **화면과 같은 규칙**이어야 해서
   * `resolvePetSafetyLevel`(@pawlog/shared)을 그대로 돌린다. 한 매장의 원생은 수십 마리
   * 규모라 전수 평가가 문제되지 않는다 — 규모가 커지면 그때 판정 결과를 컬럼으로
   * 물질화하고, 그때도 **규칙은 이 함수 하나**여야 한다.
   */
  async getPetSummary() {
    const [attendanceGroups, pets] = await tenantTransaction(prisma, (tx) =>
      Promise.all([
        tx.attendance.groupBy({
          by: ["status"],
          where: { date: startOfToday() },
          _count: { _all: true },
        }),
        tx.pet.findMany({
          where: { status: PET_ACTIVE_STATUS },
          select: {
            allergies: true,
            temperaments: true,
            marksIndoors: true,
            mountingBehavior: true,
            hasBiteHistory: true,
            vaccinations: true,
          },
        }),
      ]),
    );

    const countOf = (status: string) =>
      attendanceGroups.find((group) => group.status === status)?._count._all ??
      0;

    return {
      // ⚠️ 등원 중 상태값은 `CHECKED_IN` 이다(`PRESENT` 가 아니다) — `checkIn()` 이 쓰는
      // 값과 어긋나면 칩이 항상 0 을 가리키는데, 그건 화면상 "오늘 아무도 안 왔다"로 읽힌다.
      present: countOf("CHECKED_IN"),
      scheduled: countOf("SCHEDULED"),
      checkedOut: countOf("CHECKED_OUT"),
      absent: countOf("ABSENT"),
      attention: pets.filter(
        (pet) => resolvePetSafetyLevel(pet) !== BADGE_LEVEL.NORMAL,
      ).length,
      total: pets.length,
    };
  }

  /** 반려동물 상세 조회 — ADMIN 전용 (소유자 무관하게 전체 조회) */
  async getPet(id: string) {
    const pet = await prisma.pet.findUnique({
      where: { id },
      include: { user: { select: { email: true, nickname: true } } },
    });
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }
    return { pet };
  }

  /** 반려동물 등록 — ADMIN 전용. 보호자(사용자) ID 를 직접 지정한다. */
  async createPet(dto: AdminCreatePetDto) {
    const tenantId = requireTenantId();

    const owner = await prisma.user.findUnique({ where: { id: dto.userId } });
    if (!owner) {
      throw new NotFoundException("존재하지 않는 사용자입니다.");
    }

    // job-040: 여기 원래 "owner 가 그 테넌트의 구성원인지는 아래에서 확인한다"는 주석만
    // 있고 정작 확인이 없었다. User 는 tenantId 컬럼이 사라져(job-033) Prisma Extension 의
    // 자동 스코프도 걸리지 않으므로, 위 findUnique 는 **플랫폼 전역**에서 찾는다. 그래서
    // userId 를 직접 넣으면 남의 매장 회원(또는 우리와 무관한 회원)에게 원생을 붙일 수 있었다.
    // UI 가 멤버십으로 필터된 목록만 보여줘서 드러나지 않았을 뿐이다.
    const membership = await runWithoutTenant(() =>
      prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: dto.userId, tenantId } },
        select: { status: true },
      }),
    );
    if (membership?.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw new ForbiddenException(
        "이 매장의 구성원이 아닌 보호자에게는 원생을 등록할 수 없습니다.",
      );
    }

    // ⚠️ 펫을 만들기/고치기 **전에** 옮긴다 — `Pet.profileImageFileId` 는 `File` FK 이고
    // 업로드 직후의 id 는 아직 `FileTemp` 에만 있다 (pet.service.ts 의 같은 주석 참고).
    await promotePetPhoto(this.fileService, dto.profileImageFileId);

    const pet = await prisma.pet.create({
      data: {
        // job-033: 어드민이 등록하는 펫은 항상 현재 활성 테넌트의 원생이다.
        // (owner 가 그 테넌트의 구성원인지는 아래에서 멤버십으로 확인한다)
        tenantId: requireTenantId(),
        userId: dto.userId,
        name: dto.name,
        species: dto.species,
        breed: dto.breed,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        isNeutered: dto.isNeutered,
        weightKg: dto.weightKg,
        profileImageFileId: dto.profileImageFileId,
        careNote: dto.careNote,
        // 안전 정보 (job-052) — careNote 자유 텍스트에서 꺼낸 구조화 필드.
        allergies: dto.allergies,
        temperaments: dto.temperaments,
        marksIndoors: dto.marksIndoors,
        mountingBehavior: dto.mountingBehavior,
        hasBiteHistory: dto.hasBiteHistory,
        vaccinations: toVaccinationsJson(dto.vaccinations),
        adaptationStartedAt: dto.adaptationStartedAt
          ? new Date(dto.adaptationStartedAt)
          : undefined,
        // 픽업 (job-052) — 원생 목록의 기본 정렬 키.
        pickupTime: dto.pickupTime,
        pickupMethod: dto.pickupMethod,
        shuttleNumber: dto.shuttleNumber,
        guardianName: dto.guardianName,
        guardianPhone: cleanPhone(dto.guardianPhone),
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: cleanPhone(dto.emergencyContactPhone),
        pickupAuthorizedPersons: toPickupPersonsJson(
          dto.pickupAuthorizedPersons,
        ),
        scheduleType: dto.scheduleType,
        scheduleDays: dto.scheduleDays,
        photoConsent: dto.photoConsent,
      },
    });
    return { pet };
  }

  /** 반려동물 정보 수정 — ADMIN 전용 (소유자 무관하게 전체 대상) */
  async updatePet(id: string, dto: UpdatePetDto) {
    const target = await prisma.pet.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }

    // ⚠️ 펫을 만들기/고치기 **전에** 옮긴다 — `Pet.profileImageFileId` 는 `File` FK 이고
    // 업로드 직후의 id 는 아직 `FileTemp` 에만 있다 (pet.service.ts 의 같은 주석 참고).
    await promotePetPhoto(this.fileService, dto.profileImageFileId);

    const pet = await prisma.pet.update({
      where: { id },
      data: {
        name: dto.name,
        species: dto.species,
        breed: dto.breed,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        isNeutered: dto.isNeutered,
        weightKg: dto.weightKg,
        profileImageFileId: dto.profileImageFileId,
        careNote: dto.careNote,
        // 안전 정보 (job-052) — careNote 자유 텍스트에서 꺼낸 구조화 필드.
        allergies: dto.allergies,
        temperaments: dto.temperaments,
        marksIndoors: dto.marksIndoors,
        mountingBehavior: dto.mountingBehavior,
        hasBiteHistory: dto.hasBiteHistory,
        vaccinations: toVaccinationsJson(dto.vaccinations),
        adaptationStartedAt: dto.adaptationStartedAt
          ? new Date(dto.adaptationStartedAt)
          : undefined,
        // 픽업 (job-052) — 원생 목록의 기본 정렬 키.
        pickupTime: dto.pickupTime,
        pickupMethod: dto.pickupMethod,
        shuttleNumber: dto.shuttleNumber,
        guardianName: dto.guardianName,
        guardianPhone: cleanPhone(dto.guardianPhone),
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: cleanPhone(dto.emergencyContactPhone),
        pickupAuthorizedPersons: toPickupPersonsJson(
          dto.pickupAuthorizedPersons,
        ),
        scheduleType: dto.scheduleType,
        scheduleDays: dto.scheduleDays,
        photoConsent: dto.photoConsent,
      },
    });
    return { pet };
  }
}
