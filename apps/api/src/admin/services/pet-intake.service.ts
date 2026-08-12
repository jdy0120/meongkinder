import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { prisma, requireTenantId, runWithoutTenant } from "@pawlog/database";
import {
  MEMBERSHIP_STATUS,
  PET_INTAKE_GUARDIAN_STATUS,
  PET_INTAKE_MODE,
  ROLES,
} from "@pawlog/shared";

import {
  InvitationService,
  normalizePhone,
} from "../../membership/services/invitation.service";
import {
  cleanPhone,
  promotePetPhoto,
  toPickupPersonsJson,
} from "../../pet/services/pet.service";
import { FileService } from "../../shared/file/services/file.service";
import { PetIntakeDto } from "../dtos";

/** 한국 휴대폰 번호는 정규화하면 10~11자리다. 오타로 몇 자만 친 조회를 막는다. */
const MIN_PHONE_DIGITS = 10;

/**
 * 원생 등록 단일 진입점 (job-040).
 *
 * ## 왜 하나로 합치는가
 *
 * 원장이 등록을 시작할 때 아는 것은 **전화번호뿐**이다. 그 보호자가 우리 서비스에
 * 가입했는지, 이미 아이를 등록해 뒀는지는 모른다. 그런데 예전 구조는 등록 화면이 둘로
 * 갈려 있어서(회원용 펫 등록 / 비회원용 초대장) 원장이 먼저 그걸 알아야 문을 고를 수
 * 있었다. 실제로는 회원 검색이 빈손으로 돌아오면 창을 닫고 다른 메뉴로 가서 처음부터
 * 다시 입력하는 흐름이 된다.
 *
 * 그래서 번호를 먼저 받고 **분기는 서버가 판단한다.** 원장이 보는 결과는 어느 경우든
 * "등록됐습니다" 하나다.
 *
 * ## 세 갈래
 *
 * | 보호자 상태 | 결과 |
 * | --- | --- |
 * | 우리 매장 구성원 + 이미 등록한 아이 | 그 아이를 원생으로 받는다 (`ENROLLED_EXISTING`) |
 * | 회원 (구성원 여부 무관) | 멤버십을 보장하고 아이를 만든다 (`CREATED_FOR_MEMBER`) |
 * | 미가입 | `userId = null` 로 아이를 만들고 초대장을 남긴다 (`CREATED_FOR_UNREGISTERED`) |
 *
 * 마지막 갈래가 이 서비스의 핵심이다. 알림톡은 계정이 아니라 전화번호로 나가므로, 그
 * 아이는 **등록된 그날부터** 출석·사진·알림장이 정상적으로 돌아간다. 보호자가 나중에 같은
 * 번호로 가입하면 `InvitationService.claimForUser` 가 초대장을 통해 계정을 연결한다.
 *
 * ## 전화번호를 신원 판단에 쓰는 것에 대해
 *
 * `User.phone` 은 유니크가 아니고 본인인증도 없다. 그래서 이 서비스는 번호가 **정확히 한
 * 명**에게만 걸릴 때에만 그 회원으로 판단하고, 둘 이상이면 409 로 멈춘다(사람이 봐야 하는
 * 상황이다). 오판의 결과는 계정 탈취가 아니라 "등록한 아이가 엉뚱한 계정에 붙는다"이고,
 * 원장이 화면에서 매칭된 회원 이름을 확인하고 넘어가므로 실무상 한 번 더 걸러진다.
 */
@Injectable()
export class PetIntakeService {
  private readonly logger = new Logger(PetIntakeService.name);

  constructor(
    private readonly invitationService: InvitationService,
    private readonly fileService: FileService,
  ) {}

  /**
   * 새 아이의 프로필 사진을 영구 저장소로 옮긴다 (job-053).
   *
   * ⚠️ 펫을 만들기 **전에** 불러야 한다 — `Pet.profileImageFileId` 는 `File` FK 이고
   * 업로드 직후의 id 는 아직 `FileTemp` 에만 있어, 순서가 뒤집히면 FK 위반으로 등록이
   * 통째로 실패한다.
   */
  private async promotePhoto(dto: PetIntakeDto) {
    await promotePetPhoto(this.fileService, dto.pet?.profileImageFileId);
  }

  /**
   * 전화번호로 보호자와 등록 후보 아이를 조회한다.
   *
   * **아이 목록은 우리 매장 구성원일 때만 내려준다.** 그러지 않으면 번호를 넣어보는 것만으로
   * 아무나 남의 아이 이름을 알아낼 수 있다. 구성원이 아닌 회원에게는 "가입한 회원입니다"
   * 까지만 알려주고, 새 아이를 등록하는 순간 멤버십이 만들어지면서 그 뒤부터 목록이 보인다
   * (그 시점에는 TenantMembership 로우가 남아 누가 언제 편입시켰는지 추적된다).
   */
  async lookup(phoneRaw: string) {
    const phone = this.requireValidPhone(phoneRaw);
    const tenantId = requireTenantId();

    const guardian = await this.findSingleUserByPhone(phone);
    if (!guardian) {
      return {
        status: PET_INTAKE_GUARDIAN_STATUS.NOT_REGISTERED,
        guardian: null,
        membershipStatus: null,
        pets: [],
      };
    }

    const membership = await runWithoutTenant(() =>
      prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: guardian.id, tenantId } },
        select: { status: true },
      }),
    );

    if (!membership) {
      return {
        status: PET_INTAKE_GUARDIAN_STATUS.MEMBER_ELSEWHERE,
        guardian,
        membershipStatus: null,
        pets: [],
      };
    }

    // 우리 매장 원생이거나 아직 어느 매장에도 등록되지 않은 아이만 보여준다.
    // 다른 매장에 등원 중인 아이는 숨긴다 — 그 아이가 어느 유치원에 다니는지는
    // 우리가 알려줄 정보가 아니다.
    const pets = await runWithoutTenant(() =>
      prisma.pet.findMany({
        where: {
          userId: guardian.id,
          OR: [{ tenantId: null }, { tenantId }],
        },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          birthDate: true,
          tenantId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    return {
      status: PET_INTAKE_GUARDIAN_STATUS.MEMBER_OF_TENANT,
      guardian,
      membershipStatus: membership.status,
      pets: pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        birthDate: pet.birthDate ? pet.birthDate.toISOString() : null,
        enrolled: pet.tenantId === tenantId,
      })),
    };
  }

  /** 원생 등록 — 보호자의 가입 여부에 따라 서버가 분기한다. */
  async intake(actorUserId: string, dto: PetIntakeDto) {
    if (dto.petId && dto.pet) {
      throw new BadRequestException(
        "기존 아이 선택과 새 아이 등록은 동시에 할 수 없습니다.",
      );
    }
    if (!dto.petId && !dto.pet) {
      throw new BadRequestException(
        "등록할 아이를 선택하거나 새로 입력해야 합니다.",
      );
    }

    const phone = this.requireValidPhone(dto.phone);
    const guardian = await this.findSingleUserByPhone(phone);

    if (dto.petId) {
      return this.enrollExisting(actorUserId, dto.petId, guardian?.id ?? null);
    }
    return guardian
      ? this.createForMember(actorUserId, guardian.id, phone, dto)
      : this.createForUnregistered(actorUserId, phone, dto);
  }

  // ── 갈래별 처리 ────────────────────────────────────────────────────────

  /** ① 보호자가 이미 등록해 둔 아이를 우리 매장 원생으로 받는다. */
  private async enrollExisting(
    actorUserId: string,
    petId: string,
    guardianId: string | null,
  ) {
    const tenantId = requireTenantId();

    const pet = await runWithoutTenant(() =>
      prisma.pet.findUnique({ where: { id: petId } }),
    );
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }

    // 조회한 번호의 주인과 펫의 주인이 다르면 화면에서 본 것과 다른 아이를 건드리는 것이다.
    // (lookup 이 우리 매장 구성원에게만 목록을 주므로 정상 경로에선 걸릴 일이 없다)
    if (!guardianId || pet.userId !== guardianId) {
      throw new BadRequestException(
        "이 전화번호의 보호자가 등록한 아이가 아닙니다.",
      );
    }
    if (pet.tenantId === tenantId) {
      throw new ConflictException("이미 우리 매장에 등록된 아이입니다.");
    }
    if (pet.tenantId) {
      throw new ConflictException(
        "이미 다른 매장에 등원 중인 아이입니다. 보호자가 등원을 해지해야 등록할 수 있습니다.",
      );
    }

    const membershipCreated = await this.ensureActiveMembership(
      guardianId,
      actorUserId,
    );

    const updated = await runWithoutTenant(() =>
      prisma.pet.update({ where: { id: petId }, data: { tenantId } }),
    );

    return {
      mode: PET_INTAKE_MODE.ENROLLED_EXISTING,
      pet: updated,
      membershipCreated,
      invitationId: null,
    };
  }

  /** ② 가입한 보호자의 아이를 새로 만든다. */
  private async createForMember(
    actorUserId: string,
    guardianId: string,
    phone: string,
    dto: PetIntakeDto,
  ) {
    const tenantId = requireTenantId();
    const membershipCreated = await this.ensureActiveMembership(
      guardianId,
      actorUserId,
    );

    await this.promotePhoto(dto);

    const pet = await runWithoutTenant(() =>
      prisma.pet.create({
        data: this.petData(dto, phone, guardianId, tenantId),
      }),
    );

    return {
      mode: PET_INTAKE_MODE.CREATED_FOR_MEMBER,
      pet,
      membershipCreated,
      invitationId: null,
    };
  }

  /**
   * ③ 아직 가입하지 않은 보호자의 아이를 만든다.
   *
   * 계정 없이 `userId = null` 로 만들고, 같은 번호로 초대장을 남긴다. 초대장은 그 아이를
   * 가리키므로(`TenantInvitation.petId`) 나중에 가입해도 아이가 새로 생기지 않고
   * **이 아이에 계정이 연결된다.**
   */
  private async createForUnregistered(
    actorUserId: string,
    phone: string,
    dto: PetIntakeDto,
  ) {
    const tenantId = requireTenantId();
    await this.promotePhoto(dto);

    const pet = await runWithoutTenant(() =>
      prisma.pet.create({ data: this.petData(dto, phone, null, tenantId) }),
    );

    const invitation = await this.invitationService.createForExistingPet({
      invitedBy: actorUserId,
      phone,
      guardianName: dto.guardianName ?? dto.pet?.guardianName,
      petId: pet.id,
    });

    this.logger.log(
      `미가입 보호자의 원생을 등록했습니다. petId=${pet.id} phone=${this.maskPhone(phone)} ` +
        `invitationId=${invitation.id} — 알림톡은 계정 없이도 이 번호로 발송됩니다.`,
    );

    return {
      mode: PET_INTAKE_MODE.CREATED_FOR_UNREGISTERED,
      pet,
      membershipCreated: false,
      invitationId: invitation.id,
    };
  }

  // ── 내부 ───────────────────────────────────────────────────────────────

  /**
   * 새 펫 로우의 공통 데이터. 연락처가 비어 있으면 조회에 쓴 번호를 그대로 채운다.
   *
   * ⚠️ `tenantId` 는 **인자로 받는다.** 이 결과를 쓰는 쪽이 `runWithoutTenant(...)` 안에서
   * create 를 부르는데, 그 콜백 안에서 `requireTenantId()` 를 부르면 ALS 컨텍스트가 비워진
   * 상태라 "tenantId 를 확인할 수 없습니다" 로 터진다. 반드시 콜백 밖에서 읽어 넘긴다.
   */
  private petData(
    dto: PetIntakeDto,
    phone: string,
    userId: string | null,
    tenantId: string,
  ) {
    const input = dto.pet!;
    return {
      userId,
      tenantId,
      name: input.name,
      species: input.species,
      breed: input.breed,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
      gender: input.gender,
      isNeutered: input.isNeutered,
      weightKg: input.weightKg,
      profileImageFileId: input.profileImageFileId,
      careNote: input.careNote,
      guardianName: input.guardianName ?? dto.guardianName,
      // 알림톡이 나가는 번호다. 미가입 보호자에게는 이것이 **유일한** 연락 수단이므로
      // 비어 있게 두면 안 된다.
      guardianPhone: cleanPhone(input.guardianPhone) ?? phone,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: cleanPhone(input.emergencyContactPhone),
      pickupAuthorizedPersons: toPickupPersonsJson(
        input.pickupAuthorizedPersons,
      ),
      scheduleType: input.scheduleType,
      scheduleDays: input.scheduleDays,
      photoConsent: input.photoConsent,
    };
  }

  /**
   * 이 매장의 ACTIVE 구성원임을 보장한다.
   *
   * 원장이 아이를 등록한다는 것은 그 보호자를 받아들인다는 뜻이므로, 신청만 해둔
   * (PENDING) 상태라면 이 시점에 승인 처리한다. 승인자는 감사 추적을 위해 남긴다.
   *
   * @returns 이 호출로 구성원이 되었으면(신규 생성 또는 승인) true
   */
  private async ensureActiveMembership(
    guardianId: string,
    actorUserId: string,
  ) {
    const tenantId = requireTenantId();

    const existing = await runWithoutTenant(() =>
      prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: guardianId, tenantId } },
      }),
    );

    if (existing?.status === MEMBERSHIP_STATUS.ACTIVE) {
      return false;
    }

    await runWithoutTenant(() =>
      prisma.tenantMembership.upsert({
        where: { userId_tenantId: { userId: guardianId, tenantId } },
        create: {
          userId: guardianId,
          tenantId,
          role: ROLES.GUARDIAN,
          status: MEMBERSHIP_STATUS.ACTIVE,
          approvedAt: new Date(),
          approvedBy: actorUserId,
        },
        update: {
          // 역할은 건드리지 않는다 — STAFF 가 자기 강아지를 맡기는 경우가 흔한데
          // 여기서 GUARDIAN 으로 덮으면 그 사람의 매장 권한이 사라진다.
          status: MEMBERSHIP_STATUS.ACTIVE,
          approvedAt: new Date(),
          approvedBy: actorUserId,
        },
      }),
    );

    return true;
  }

  /**
   * 번호로 회원을 찾되, **정확히 한 명일 때만** 그 회원으로 판단한다.
   *
   * `User.phone` 은 유니크가 아니다(본인인증이 없어 유니크를 걸 수 없었다). 여러 계정이
   * 같은 번호를 들고 있을 때 임의로 하나를 고르면 남의 계정에 아이가 붙는다. 사람이 봐야
   * 하는 상황이므로 조용히 고르지 않고 멈춘다.
   */
  private async findSingleUserByPhone(phone: string) {
    const users = await runWithoutTenant(() =>
      prisma.user.findMany({
        where: { phone },
        select: { id: true, nickname: true },
        take: 2,
      }),
    );

    if (users.length > 1) {
      throw new ConflictException(
        "같은 전화번호를 쓰는 계정이 둘 이상입니다. 보호자에게 확인 후 관리자에게 문의해주세요.",
      );
    }
    return users[0] ?? null;
  }

  private requireValidPhone(phoneRaw: string) {
    const phone = normalizePhone(phoneRaw ?? "");
    if (phone.length < MIN_PHONE_DIGITS) {
      throw new BadRequestException("올바른 휴대폰 번호를 입력해주세요.");
    }
    return phone;
  }

  /** 로그에 번호를 통째로 남기지 않는다. */
  private maskPhone(phone: string) {
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }
}
