import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, prisma, runWithoutTenant } from "@pawlog/database";
import { FileService } from "../../shared/file/services/file.service";
import {
  buildPaginatedData,
  MEMBERSHIP_STATUS,
  normalizePhone,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import {
  CreatePetDto,
  PickupAuthorizedPersonDto,
  UpdatePetDto,
  VaccinationRecordDto,
} from "../dtos";

const PET_SORTABLE_FIELDS = ["createdAt", "name", "species"] as const;

/**
 * class-validator DTO 인스턴스를 Prisma Json 컬럼에 안전하게 저장 가능한 순수 객체로 변환.
 * 전화번호는 숫자만 남긴다 (job-043) — 픽업 담당자 번호도 나중에 매칭/발송에 쓰인다.
 */
export const toPickupPersonsJson = (
  persons?: PickupAuthorizedPersonDto[],
): Prisma.InputJsonValue | undefined =>
  persons?.map(({ name, phone, relation }) => ({
    name,
    phone: normalizePhone(phone ?? ""),
    relation,
  }));

/**
 * 예방접종 기록을 Json 컬럼에 저장 가능한 순수 객체로 변환 (job-052).
 *
 * **상태(valid/expiring_soon/expired)는 저장하지 않는다.** 저장하면 날짜가 지나도
 * 갱신되지 않아 "이미 만료됐는데 정상으로 표시되는" 실패가 나는데, 안전 정보에서 그건
 * 정보가 없는 것보다 나쁘다 — 원장이 확인했다고 믿게 만들기 때문이다.
 * 판정은 조회 시점에 `resolveVaccination`(@pawlog/shared) 이 한다.
 */
export const toVaccinationsJson = (
  records?: VaccinationRecordDto[],
): Prisma.InputJsonValue | undefined =>
  records?.map(({ type, expiresAt }) => ({
    type,
    // 날짜만 비교하므로 날짜만 저장한다. 시각이 섞이면 만료 당일 오전/오후에 답이 갈린다.
    expiresAt: expiresAt.slice(0, 10),
  }));

/**
 * 저장 직전 전화번호 정규화 (job-043).
 *
 * **저장은 언제나 숫자만이다.** 이 번호들은 표시용일 뿐 아니라 알림톡 수신처이자
 * 비회원 보호자를 계정에 잇는 매칭 키다. 화면이 하이픈을 떼고 보내더라도, 서버가
 * 마지막 방어선이어야 한다 — API 를 직접 부르는 경로(스크립트·연동)가 있고, 그쪽에서
 * 들어온 "010-1234-5678" 이 그대로 저장되면 같은 번호가 두 형태로 갈린다.
 *
 * 빈 문자열은 `undefined` 로 돌려 "값을 안 보냄"과 구분한다 — 그러지 않으면 수정 폼에서
 * 칸을 비웠을 때 빈 문자열이 저장돼, `resolveGuardianPhone` 의 폴백이 걸리지 않는다.
 */
export const cleanPhone = (value?: string | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return normalizePhone(value) || undefined;
};

/**
 * 프로필 사진의 영구 저장 경로 (job-053).
 *
 * 날짜나 펫 id 로 쪼개지 않는다 — 아이당 한 장이고 교체되면 이전 것은 지워지므로
 * 개수가 원생 수를 넘지 않는다. 반면 펫 id 로 디렉터리를 파면 등록 때는 아직 id 가
 * 없어(생성 전에 옮겨야 FK 가 성립한다) 두 번 옮기는 구조가 된다.
 */
export const PET_PHOTO_PATH = "profile";

/**
 * 펫 프로필 사진을 영구 저장소로 옮긴다 (job-055).
 *
 * 프로필 사진을 승격하는 곳이 다섯 군데다 — 보호자의 등록/수정(`PetService`),
 * 원장의 등록/수정(`AdminService`), 원생 등록 단일 진입점(`PetIntakeService`).
 * 그 다섯 곳이 `promoteTempFile` 을 각자 부르면 **`ownership` 을 한 곳만 빠뜨려도**
 * 그 경로로 올린 사진만 조용히 매장 소유가 되어, 그 아이가 등원/전학하는 순간
 * 매장 화면에서 404 가 난다(그게 원래 버그였다). 그래서 옵션을 노출하지 않고
 * 이 헬퍼 하나로 모은다.
 *
 * `ownership: "shared"` 인 이유는 `FileOwnership` 주석 참고 — 요약하면 **펫 사진은
 * 매장의 자료가 아니라 그 아이의 것**이고, 아이는 매장을 옮겨 다닌다.
 */
export const promotePetPhoto = (
  fileService: FileService,
  fileId?: string | null,
) =>
  fileService.promoteTempFile({
    fileId,
    domain: "pet",
    newPath: PET_PHOTO_PATH,
    ownership: "shared",
  });

@Injectable()
export class PetService {
  constructor(private readonly fileService: FileService) {}

  /**
   * 반려동물 등록 (job-033).
   * 어떤 매장에도 속하지 않은 회원도 자기 펫을 등록할 수 있으므로 tenantId 는 비워 둔다.
   * 유치원 등록은 별도의 enroll() 로 처리한다.
   */
  async create(userId: string, dto: CreatePetDto) {
    // ⚠️ 펫을 만들기 **전에** 옮겨야 한다. `Pet.profileImageFileId` 는 `File` 을 가리키는
    // FK 인데 업로드 직후의 id 는 아직 `FileTemp` 에만 있어, 순서를 바꾸면 FK 위반으로
    // 등록 자체가 실패한다.
    await promotePetPhoto(this.fileService, dto.profileImageFileId);

    const pet = await runWithoutTenant(() =>
      prisma.pet.create({
        data: {
          userId,
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
      }),
    );
    return { pet };
  }

  /** 내 반려동물 목록 (페이지네이션·정렬·검색) */
  async findAllByUser(userId: string, query: PaginationQuery) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = {
      userId,
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const sortField = PET_SORTABLE_FIELDS.includes(
      sort as (typeof PET_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "createdAt";

    // 소속 매장과 무관하게 내 펫 전부를 보여준다 — 활성 테넌트가 열린 요청에서도
    // 자동 스코프에 걸리지 않도록 bypass 컨텍스트에서 조회한다.
    const [items, total] = await runWithoutTenant(() =>
      prisma.$transaction(async (tx) => {
        const items = await tx.pet.findMany({
          where,
          skip,
          take,
          orderBy: { [sortField]: order },
        });
        const total = await tx.pet.count({ where });
        return [items, total] as const;
      }),
    );

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 반려동물 상세 조회 (본인 소유만) */
  async findOne(userId: string, id: string) {
    const pet = await runWithoutTenant(() =>
      prisma.pet.findFirst({ where: { id, userId } }),
    );
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }
    return { pet };
  }

  /** 반려동물 정보 수정 (본인 소유만) */
  async update(userId: string, id: string, dto: UpdatePetDto) {
    await this.findOne(userId, id);

    await promotePetPhoto(this.fileService, dto.profileImageFileId);

    const pet = await runWithoutTenant(() =>
      prisma.pet.update({
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
      }),
    );
    return { pet };
  }

  /** 반려동물 삭제 (본인 소유만) */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await runWithoutTenant(() => prisma.pet.delete({ where: { id } }));
    return { id };
  }

  /**
   * 등원 — 내 펫을 특정 매장의 원생으로 등록한다 (job-033).
   *
   * 조건은 "그 매장의 ACTIVE 구성원일 것" 하나다. 역할은 따지지 않는다 —
   * 유치원에서 일하는 스태프가 자기 강아지를 그 유치원에 맡기는 경우가 흔하고,
   * @@unique([userId, tenantId]) 때문에 한 매장에서 STAFF 와 GUARDIAN 을 겸할 수 없기 때문이다.
   * 소속돼 있다는 사실 자체가 맡길 자격의 근거다.
   */
  async enroll(userId: string, petId: string, tenantId: string) {
    const { pet } = await this.findOne(userId, petId);

    if (pet.tenantId === tenantId) {
      throw new ConflictException("이미 이 매장에 등록된 아이입니다.");
    }
    if (pet.tenantId) {
      throw new ConflictException(
        "이미 다른 매장에 등록된 아이입니다. 먼저 등원을 해지해주세요.",
      );
    }

    const membership = await runWithoutTenant(() =>
      prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      }),
    );
    if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw new ForbiddenException(
        membership?.status === MEMBERSHIP_STATUS.PENDING
          ? "가입 승인 대기 중입니다. 승인 후 아이를 등록할 수 있습니다."
          : "소속되지 않은 매장에는 아이를 등록할 수 없습니다.",
      );
    }

    const updated = await runWithoutTenant(() =>
      prisma.pet.update({ where: { id: petId }, data: { tenantId } }),
    );
    return { pet: updated };
  }

  /**
   * 등원 해지 — 펫을 개인 소유 상태로 되돌린다.
   * 출석/일일 리포트 이력은 매장에 그대로 남는다(과거 기록이라 지우지 않는다).
   */
  async unenroll(userId: string, petId: string) {
    const { pet } = await this.findOne(userId, petId);

    if (!pet.tenantId) {
      throw new ConflictException("등록된 매장이 없습니다.");
    }

    const updated = await runWithoutTenant(() =>
      prisma.pet.update({ where: { id: petId }, data: { tenantId: null } }),
    );
    return { pet: updated };
  }
}
