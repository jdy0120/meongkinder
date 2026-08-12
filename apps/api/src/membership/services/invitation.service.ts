import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { prisma, requireTenantId, runWithoutTenant } from "@pawlog/database";
import {
  higherMembershipRole,
  isMembershipRole,
  MEMBERSHIP_STATUS,
  normalizePhone,
  ROLES,
} from "@pawlog/shared";
import type { MembershipRole } from "@pawlog/shared";
import * as crypto from "crypto";

import { CreateInvitationDto } from "../dtos";

const INVITATION_TTL_DAYS = 30;

/**
 * 원생-계정 연결용 자리표시자의 유효기간 (job-040).
 *
 * 사람에게 보내는 초대 링크가 아니라 "이 번호로 가입하면 이 아이에 연결한다"는 약속이라,
 * 30일 만료를 그대로 쓰면 그 사이에 가입하지 않은 보호자는 영영 연결되지 않는다.
 * 만료 개념 자체를 없애려면 컬럼이 nullable 이어야 해서, 사실상 만료되지 않는 값을 준다.
 */
const PET_LINK_TTL_DAYS = 3650;

const INVITATION_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED",
} as const;

// job-043: 구현은 `@pawlog/shared` 로 옮겼다 — 웹에서도 같은 규칙으로 입력을 눌러야
// 하는데 여기(API 서비스 파일)에 있으면 프런트가 쓸 수 없었다. 기존 import 경로를 쓰는
// 곳이 여럿이라 이름은 그대로 다시 내보낸다.
export { normalizePhone };

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  /**
   * 구성원 초대 (job-034).
   *
   * 상대가 **이미 회원이면 초대장이 필요 없다** — 곧바로 ACTIVE 멤버십을 만들어 준다.
   * 아직 회원이 아니면 연락처만 담은 TenantInvitation 을 남기고, 그 사람이 같은
   * 이메일/전화번호로 가입하는 순간 자동으로 매칭된다(claimForUser).
   *
   * job-058: **자격을 주는 것이 전부다.** 아이는 여기서 다루지 않는다 — 미가입 보호자의
   * 아이는 원생 등록 단일 진입점(`POST v1/admin/pets/intake`)이 맡고, 그쪽은 계정 없이
   * Pet 을 즉시 만들어 그날부터 등하원·알림톡이 돌아간다.
   */
  async create(invitedBy: string, dto: CreateInvitationDto) {
    const tenantId = requireTenantId();
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone ? normalizePhone(dto.phone) : undefined;

    if (!email && !phone) {
      throw new BadRequestException(
        "이메일 또는 휴대폰 번호 중 하나는 반드시 입력해야 합니다.",
      );
    }

    const role = dto.role ?? ROLES.GUARDIAN;

    // 이미 가입한 회원인지 확인 (이메일 우선, 없으면 전화번호)
    const existingUser = await runWithoutTenant(() =>
      email
        ? prisma.user.findUnique({ where: { email } })
        : prisma.user.findFirst({ where: { phone } }),
    );

    // 자기 자신은 초대할 수 없다 (job-058).
    //
    // 초대는 **아직 이 매장에 없는 사람을 넣는** 행위인데, 초대하는 본인은 정의상 이미
    // 소속돼 있다(이 API 를 부르려면 TENANT_ADMIN 이어야 한다). 그래서 자기 초대는 어떤
    // 경우에도 얻을 것이 없고, 잃을 것만 있었다 — 가입자 이메일이면 링크를 누를 필요도
    // 없이 그 자리에서 attach 되므로, 원장이 구성원 관리에서 실수로 자기 이메일을 넣는
    // 순간 즉시 자기 자격이 초대 역할로 바뀌었다.
    //
    // 강등 자체는 위 attach() 에서도 막지만, 두 가드는 목적이 다르다. 여기서 막는 것은
    // "무의미한 요청"이고, 거기서 막는 것은 "제3자가 보낸 초대로 인한 강등"이다.
    // 하나만 있어도 이번 사고는 안 나지만, 남겨두면 사용자는 아무 일도 일어나지 않은
    // 초대장이 목록에 쌓이는 이유를 알 수 없다.
    if (existingUser && existingUser.id === invitedBy) {
      throw new BadRequestException(
        "본인은 초대할 수 없습니다. 이미 이 매장의 구성원입니다.",
      );
    }

    const invitation = await runWithoutTenant(() =>
      prisma.tenantInvitation.create({
        data: {
          tenantId,
          role,
          email: email ?? null,
          phone: phone ?? null,
          // job-058: 아이 정보는 더 이상 이 경로로 받지 않는다(자격 부여 전용).
          // 컬럼은 남아 있다 — 아직 수락되지 않은 기존 초대장이 값을 물고 있고,
          // `attachWithPet` 이 그걸 계속 소비한다.
          token: crypto.randomUUID(),
          invitedBy,
          expiresAt: this.expiryDate(),
          status: INVITATION_STATUS.PENDING,
        },
      }),
    );

    if (!existingUser) {
      // 미가입자 — 초대장이 자리표시자로 남는다. 가입 시 자동 매칭.
      return { invitation };
    }

    const membership = await this.attach(existingUser.id, invitation.id);

    // attach 가 초대를 ACCEPTED 로 갱신하므로, 위에서 만든 객체를 그대로 반환하면
    // 응답에 PENDING 이 실려 나간다(DB 와 불일치). 갱신된 로우를 다시 읽어 내려준다.
    const accepted = await runWithoutTenant(() =>
      prisma.tenantInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      }),
    );
    return { invitation: accepted, membership };
  }

  /**
   * 이미 만들어진 원생을 가리키는 초대장을 남긴다 (job-040, 원생 등록 단일 진입점 전용).
   *
   * `create()` 와 다른 점이 둘 있다:
   *   1. **회원 여부를 다시 보지 않는다.** 이 경로는 호출부(PetIntakeService)가 이미
   *      "미가입 보호자"로 판정한 뒤에만 들어온다. 여기서 또 조회하면 판정이 두 군데로
   *      갈려 서로 다른 결론을 낼 수 있다.
   *   2. 아이 정보를 초대장에 베껴 담지 않고 **`petId` 로 가리키기만 한다.** 실제 Pet 로우가
   *      이미 있으므로, 수락 시 새로 만드는 대신 그 아이에 계정을 연결한다.
   */
  async createForExistingPet(params: {
    invitedBy: string;
    phone: string;
    guardianName?: string;
    petId: string;
  }) {
    const tenantId = requireTenantId();

    return runWithoutTenant(() =>
      prisma.tenantInvitation.create({
        data: {
          tenantId,
          role: ROLES.GUARDIAN,
          phone: normalizePhone(params.phone),
          guardianName: params.guardianName ?? null,
          petId: params.petId,
          token: crypto.randomUUID(),
          invitedBy: params.invitedBy,
          // 일반 초대장의 30일 만료를 쓰지 않는다. 그건 "링크를 받았으면 곧 눌러라"는
          // 뜻인데, 이건 링크가 아니라 **번호와 아이를 묶어두는 상시 자리표시자**다.
          // 원생은 몇 년씩 다니고, 보호자는 반년 뒤에 가입할 수도 있다. 30일로 두면
          // 그 사이 만료돼 가입해도 아이가 연결되지 않고 조용히 두 마리로 갈라진다.
          expiresAt: this.expiryDate(PET_LINK_TTL_DAYS),
          status: INVITATION_STATUS.PENDING,
        },
      }),
    );
  }

  /** 초대 목록 (관리자) */
  async list(status?: string) {
    const tenantId = requireTenantId();
    const invitations = await runWithoutTenant(() =>
      prisma.tenantInvitation.findMany({
        where: { tenantId, ...(status ? { status } : {}) },
        orderBy: { createdAt: "desc" },
      }),
    );
    return { invitations };
  }

  /** 초대 취소 (관리자) */
  async cancel(id: string) {
    const tenantId = requireTenantId();
    const invitation = await runWithoutTenant(() =>
      prisma.tenantInvitation.findFirst({ where: { id, tenantId } }),
    );
    if (!invitation) {
      throw new NotFoundException("존재하지 않는 초대입니다.");
    }
    if (invitation.status !== INVITATION_STATUS.PENDING) {
      throw new BadRequestException("이미 처리된 초대입니다.");
    }

    const canceled = await runWithoutTenant(() =>
      prisma.tenantInvitation.update({
        where: { id },
        data: { status: INVITATION_STATUS.CANCELED },
      }),
    );
    return { invitation: canceled };
  }

  /**
   * 초대 링크 미리보기 (공개).
   * 링크만 가진 사람에게도 보여줘야 하므로 이메일/전화번호 같은 개인정보는 내리지 않는다.
   */
  async lookup(token: string) {
    const invitation = await runWithoutTenant(() =>
      prisma.tenantInvitation.findUnique({
        where: { token },
        include: { tenant: { select: { name: true } } },
      }),
    );
    if (!invitation) {
      throw new NotFoundException("존재하지 않는 초대입니다.");
    }

    return {
      tenantName: invitation.tenant.name,
      role: invitation.role as MembershipRole,
      petName: invitation.petName,
      expiresAt: invitation.expiresAt,
      status: this.effectiveStatus(invitation),
    };
  }

  /** 로그인 회원이 초대 토큰으로 직접 수락 */
  async accept(userId: string, token: string) {
    const invitation = await runWithoutTenant(() =>
      prisma.tenantInvitation.findUnique({ where: { token } }),
    );
    if (!invitation) {
      throw new NotFoundException("존재하지 않는 초대입니다.");
    }
    return this.attachWithPet(userId, invitation.id);
  }

  /**
   * 가입 직후 호출 — 이 회원의 이메일/전화번호로 대기 중인 초대를 모두 찾아 소속 처리한다.
   * "초대를 대체하는 자리표시자"가 실제 멤버십과 펫으로 실현되는 지점이다.
   *
   * 가입 흐름을 막지 않기 위해 개별 초대 처리 실패는 삼킨다 — 회원가입 자체는 성공해야 한다.
   */
  async claimForUser(userId: string, email: string, phone?: string | null) {
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    const pending = await runWithoutTenant(() =>
      prisma.tenantInvitation.findMany({
        where: {
          status: INVITATION_STATUS.PENDING,
          expiresAt: { gt: new Date() },
          OR: [
            { email: email.toLowerCase() },
            ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ],
        },
      }),
    );

    const claimed: string[] = [];
    for (const invitation of pending) {
      try {
        await this.attachWithPet(userId, invitation.id);
        claimed.push(invitation.id);
      } catch {
        // 이미 소속됐거나 만료된 건 — 가입 자체를 실패시키지 않는다.
      }
    }
    return claimed;
  }

  // ── 내부 ─────────────────────────────────────────────────────────────

  /**
   * 초대를 멤버십으로 전환하고, 아이까지 이어 붙인다.
   *
   * 두 갈래가 있고 순서가 중요하다 (job-040):
   *   1. `petId` 가 있으면 — 매장이 이미 등록해 둔 원생이다. **새로 만들지 않고 계정만 연결한다.**
   *      새로 만들면 같은 아이가 두 마리로 갈라지고, 가입 전까지 쌓인 출석·알림장·사진이
   *      전부 보호자에게 안 보이는 쪽(userId = null)에 남는다.
   *   2. `petName` 만 있으면 — 계정도 펫도 없던 순수 선등록(job-034)이므로 새로 만든다.
   */
  private async attachWithPet(userId: string, invitationId: string) {
    const membership = await this.attach(userId, invitationId);

    const invitation = await runWithoutTenant(() =>
      prisma.tenantInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      }),
    );

    if (invitation.petId) {
      // 이미 있는 원생에 계정을 연결한다. 다른 사람이 먼저 가져가는 것을 막기 위해
      // `userId: null` 조건을 건다 — updateMany 라 조건에 안 맞으면 0건 갱신으로 끝난다.
      const linked = await runWithoutTenant(() =>
        prisma.pet.updateMany({
          where: { id: invitation.petId!, userId: null },
          data: { userId },
        }),
      );

      if (linked.count === 0) {
        // 이미 다른 계정이 연결된 펫이다. 초대는 수락 처리됐고 멤버십도 만들어졌으므로
        // 가입 흐름을 막지는 않되, 사람이 확인해야 할 상황이라 로그로 남긴다.
        this.logger.warn(
          `초대가 가리키는 원생에 이미 다른 계정이 연결되어 있어 연결을 건너뜁니다. ` +
            `invitationId=${invitationId} petId=${invitation.petId} userId=${userId}`,
        );
        return { membership };
      }

      return { membership, petId: invitation.petId };
    }

    if (!invitation.petName) {
      return { membership };
    }

    // 초대에 담긴 아이 정보로 펫을 만들고 곧바로 해당 매장에 등록해 둔다.
    const pet = await runWithoutTenant(() =>
      prisma.pet.create({
        data: {
          userId,
          tenantId: invitation.tenantId,
          name: invitation.petName!,
          species: invitation.petSpecies ?? "DOG",
          breed: invitation.petBreed,
          birthDate: invitation.petBirthDate,
          guardianName: invitation.guardianName,
          guardianPhone: invitation.phone,
          careNote: invitation.note,
        },
      }),
    );

    return { membership, petId: pet.id };
  }

  /** 초대를 수락 처리하고 ACTIVE 멤버십을 만든다(이미 있으면 되살린다). */
  private async attach(userId: string, invitationId: string) {
    const invitation = await runWithoutTenant(() =>
      prisma.tenantInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      }),
    );

    if (invitation.status === INVITATION_STATUS.ACCEPTED) {
      throw new ConflictException("이미 수락된 초대입니다.");
    }
    if (invitation.status === INVITATION_STATUS.CANCELED) {
      throw new BadRequestException("취소된 초대입니다.");
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("만료된 초대입니다.");
    }

    const invitedRole = invitation.role as MembershipRole;

    // 이미 소속된 사람이면 **초대가 자격을 낮추지 못하게 한다** (job-058).
    //
    // 멤버십은 `[userId, tenantId]` 유니크라 한 사람당 한 행이고, 예전에는 이 upsert 가
    // `update: { role }` 로 기존 역할을 조건 없이 덮어썼다. 그래서 원장에게 STAFF 초대가
    // 한 번 닿으면 **경고도 로그도 없이 원장이 스태프로 강등**됐다. 실제로 매장을 만든
    // 원장이 구성원 관리에서 자기 이메일을 넣자 그 자리에서 강등돼(가입자 이메일이면
    // 링크 없이 즉시 attach 된다) 매장에 관리자가 0명이 됐고, 역할 변경 API 자체가
    // TENANT_ADMIN 을 요구하므로 **매장 안에서는 아무도 복구할 수 없는 상태**가 됐다.
    //
    // 승격은 그대로 둔다 — 보호자였던 사람을 스태프로 채용하는 건 초대의 정상 용법이다.
    // 강등이 필요하면 역할 변경(`PATCH v1/memberships/:id/role`)을 쓴다. 그쪽에는 본인
    // 강등 차단과 마지막 관리자 보호가 이미 있고, 여기(초대)에는 둘 다 없었다.
    const existing = await runWithoutTenant(() =>
      prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId: invitation.tenantId } },
        select: { role: true },
      }),
    );

    const role =
      existing && isMembershipRole(existing.role)
        ? higherMembershipRole(existing.role, invitedRole)
        : invitedRole;

    if (role !== invitedRole) {
      this.logger.warn(
        `초대 역할(${invitedRole})이 기존 역할(${existing?.role})보다 낮아 강등하지 않고 유지합니다. ` +
          `invitationId=${invitationId} userId=${userId} tenantId=${invitation.tenantId}`,
      );
    }

    const membership = await runWithoutTenant(() =>
      prisma.tenantMembership.upsert({
        where: {
          userId_tenantId: { userId, tenantId: invitation.tenantId },
        },
        // 초대는 관리자가 명시적으로 부여한 자격이므로 승인 절차 없이 곧바로 ACTIVE.
        update: {
          role,
          status: MEMBERSHIP_STATUS.ACTIVE,
          approvedAt: new Date(),
          approvedBy: invitation.invitedBy,
        },
        create: {
          userId,
          tenantId: invitation.tenantId,
          role,
          status: MEMBERSHIP_STATUS.ACTIVE,
          approvedAt: new Date(),
          approvedBy: invitation.invitedBy,
        },
      }),
    );

    await runWithoutTenant(() =>
      prisma.tenantInvitation.update({
        where: { id: invitationId },
        data: {
          status: INVITATION_STATUS.ACCEPTED,
          acceptedUserId: userId,
          acceptedAt: new Date(),
        },
      }),
    );

    return membership;
  }

  private expiryDate(days: number = INVITATION_TTL_DAYS): Date {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  /** 저장된 status 가 PENDING 이어도 만료일이 지났으면 EXPIRED 로 보여준다. */
  private effectiveStatus(invitation: {
    status: string;
    expiresAt: Date;
  }): string {
    if (
      invitation.status === INVITATION_STATUS.PENDING &&
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      return INVITATION_STATUS.EXPIRED;
    }
    return invitation.status;
  }
}
