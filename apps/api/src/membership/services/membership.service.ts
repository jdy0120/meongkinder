import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, requireTenantId, runWithoutTenant } from "@pawlog/database";
import {
  buildPaginatedData,
  MEMBERSHIP_STATUS,
  resolvePagination,
  ROLES,
  type MembershipRole,
  type MembershipStatus,
  type PaginationQuery,
} from "@pawlog/shared";

const MEMBERSHIP_SORTABLE_FIELDS = ["createdAt", "role", "status"] as const;

@Injectable()
export class MembershipService {
  // ── 회원 본인 ────────────────────────────────────────────────────────
  // 아래 조회는 "내가 속한 모든 테넌트"를 가로질러야 하므로 반드시 bypass 컨텍스트에서 실행한다.
  // TenantMembership 은 애초에 자동 스코프 대상이 아니지만, 활성 테넌트가 열린 요청에서도
  // 동일하게 동작해야 하므로 의도를 명시적으로 표현한다.

  /** 내가 속한/신청한 테넌트 목록 */
  async listMine(userId: string) {
    const memberships = await runWithoutTenant(() =>
      prisma.tenantMembership.findMany({
        where: {
          userId,
          status: {
            in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.PENDING],
          },
        },
        include: {
          tenant: {
            select: { id: true, name: true, subdomain: true, isActive: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    );
    return { memberships };
  }

  /**
   * 보호자로 가입 신청 — 승인 대기(PENDING) 상태로 만들어진다.
   * 승인 전까지는 해당 테넌트의 어떤 리소스에도 접근할 수 없다(TenantMiddleware 가 막는다).
   */
  async apply(userId: string, tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("존재하지 않는 매장입니다.");
    }
    if (!tenant.isActive) {
      throw new BadRequestException("현재 운영하지 않는 매장입니다.");
    }

    const existing = await runWithoutTenant(() =>
      prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      }),
    );

    if (existing) {
      if (existing.status === MEMBERSHIP_STATUS.ACTIVE) {
        throw new ConflictException("이미 소속된 매장입니다.");
      }
      if (existing.status === MEMBERSHIP_STATUS.PENDING) {
        throw new ConflictException("이미 승인 대기 중인 신청이 있습니다.");
      }
      // 반려/탈퇴 이력이 있으면 같은 로우를 PENDING 으로 되살린다
      // (@@unique([userId, tenantId]) 때문에 새로 만들 수 없다).
      const revived = await runWithoutTenant(() =>
        prisma.tenantMembership.update({
          where: { id: existing.id },
          data: {
            role: ROLES.GUARDIAN,
            status: MEMBERSHIP_STATUS.PENDING,
            approvedAt: null,
            approvedBy: null,
          },
        }),
      );
      return { membership: revived };
    }

    const membership = await runWithoutTenant(() =>
      prisma.tenantMembership.create({
        data: {
          userId,
          tenantId,
          role: ROLES.GUARDIAN,
          status: MEMBERSHIP_STATUS.PENDING,
        },
      }),
    );
    return { membership };
  }

  /** 소속 탈퇴 (본인). 마지막 관리자는 탈퇴할 수 없다. */
  async leave(userId: string, membershipId: string) {
    const membership = await runWithoutTenant(() =>
      prisma.tenantMembership.findFirst({
        where: { id: membershipId, userId },
      }),
    );
    if (!membership) {
      throw new NotFoundException("존재하지 않는 소속입니다.");
    }

    await this.assertNotLastAdmin(membership);

    const updated = await runWithoutTenant(() =>
      prisma.tenantMembership.update({
        where: { id: membershipId },
        data: { status: MEMBERSHIP_STATUS.LEFT },
      }),
    );
    return { membership: updated };
  }

  // ── 테넌트 관리자 (활성 테넌트 스코프) ───────────────────────────────

  /** 구성원 목록 (승인 대기 포함, 상태/역할 필터) */
  async list(
    query: PaginationQuery & {
      status?: MembershipStatus;
      role?: MembershipRole;
    },
  ) {
    const tenantId = requireTenantId();
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { email: { contains: search, mode: "insensitive" as const } },
                {
                  nickname: { contains: search, mode: "insensitive" as const },
                },
              ],
            },
          }
        : {}),
    };

    const sortField = MEMBERSHIP_SORTABLE_FIELDS.includes(
      sort as (typeof MEMBERSHIP_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "createdAt";

    const [items, total] = await runWithoutTenant(() =>
      prisma.$transaction([
        prisma.tenantMembership.findMany({
          where,
          skip,
          take,
          orderBy: { [sortField]: order },
          include: {
            user: {
              select: { id: true, email: true, nickname: true, phone: true },
            },
          },
        }),
        prisma.tenantMembership.count({ where }),
      ]),
    );

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 가입 신청 승인/반려 */
  async decide(
    adminUserId: string,
    membershipId: string,
    status: Extract<MembershipStatus, "ACTIVE" | "REJECTED">,
  ) {
    const membership = await this.findInCurrentTenant(membershipId);

    if (membership.status !== MEMBERSHIP_STATUS.PENDING) {
      throw new BadRequestException("승인 대기 중인 신청이 아닙니다.");
    }

    const updated = await runWithoutTenant(() =>
      prisma.tenantMembership.update({
        where: { id: membershipId },
        data: {
          status,
          approvedAt: status === MEMBERSHIP_STATUS.ACTIVE ? new Date() : null,
          approvedBy: adminUserId,
        },
      }),
    );
    return { membership: updated };
  }

  /** 구성원 역할 변경 */
  async updateRole(
    adminUserId: string,
    membershipId: string,
    role: MembershipRole,
  ) {
    const membership = await this.findInCurrentTenant(membershipId);

    if (membership.userId === adminUserId) {
      // 마지막 관리자가 스스로를 강등해 매장이 잠기는 것을 방지.
      throw new BadRequestException("본인의 역할은 변경할 수 없습니다.");
    }
    if (membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw new BadRequestException(
        "정상 소속 상태의 구성원만 변경할 수 있습니다.",
      );
    }

    const updated = await runWithoutTenant(() =>
      prisma.tenantMembership.update({
        where: { id: membershipId },
        data: { role },
      }),
    );
    return { membership: updated };
  }

  /** 구성원 내보내기 */
  async remove(adminUserId: string, membershipId: string) {
    const membership = await this.findInCurrentTenant(membershipId);

    if (membership.userId === adminUserId) {
      throw new BadRequestException("본인은 내보낼 수 없습니다.");
    }
    await this.assertNotLastAdmin(membership);

    const updated = await runWithoutTenant(() =>
      prisma.tenantMembership.update({
        where: { id: membershipId },
        data: { status: MEMBERSHIP_STATUS.LEFT },
      }),
    );
    return { membership: updated };
  }

  // ── 내부 헬퍼 ────────────────────────────────────────────────────────

  /**
   * 현재 활성 테넌트에 속한 멤버십인지 확인한다.
   * TenantMembership 은 자동 스코프 대상이 아니므로 tenantId 를 명시적으로 검사해야 한다 —
   * 빠뜨리면 다른 테넌트의 멤버십을 id 만으로 조작할 수 있게 된다.
   */
  private async findInCurrentTenant(membershipId: string) {
    const tenantId = requireTenantId();
    const membership = await runWithoutTenant(() =>
      prisma.tenantMembership.findFirst({
        where: { id: membershipId, tenantId },
      }),
    );
    if (!membership) {
      throw new NotFoundException("존재하지 않는 구성원입니다.");
    }
    return membership;
  }

  /** 매장에 관리자가 한 명뿐이면 그 관리자를 제거/탈퇴시킬 수 없다(잠김 방지). */
  private async assertNotLastAdmin(membership: {
    tenantId: string;
    role: string;
    status: string;
  }) {
    if (membership.role !== ROLES.TENANT_ADMIN) return;
    if (membership.status !== MEMBERSHIP_STATUS.ACTIVE) return;

    const admins = await runWithoutTenant(() =>
      prisma.tenantMembership.count({
        where: {
          tenantId: membership.tenantId,
          role: ROLES.TENANT_ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
        },
      }),
    );

    if (admins <= 1) {
      throw new ForbiddenException(
        "매장의 마지막 관리자는 탈퇴하거나 제거할 수 없습니다. 다른 관리자를 먼저 지정해주세요.",
      );
    }
  }
}
