import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, runWithoutTenant } from "@pawlog/database";
import {
  buildPaginatedData,
  MEMBERSHIP_STATUS,
  normalizePhone,
  resolvePagination,
  ROLES,
  type CreatePlatformUserRequest,
  type PaginationQuery,
  type PlatformRole,
} from "@pawlog/shared";
import * as bcrypt from "bcryptjs";

import { InvitationService } from "../../membership/services/invitation.service";

const BCRYPT_ROUNDS = 10;

const USER_SORTABLE_FIELDS = [
  "createdAt",
  "email",
  "nickname",
  "role",
  "status",
] as const;

const SEAT_SORTABLE_FIELDS = [
  "createdAt",
  "startDate",
  "endDate",
  "nextPaymentDate",
] as const;

/** 소속 요약 — 어느 매장에 어떤 자격으로 있는지 한눈에 보이도록 함께 내린다. */
const MEMBERSHIP_SUMMARY = {
  select: {
    role: true,
    status: true,
    tenant: { select: { id: true, name: true, subdomain: true } },
  },
} as const;

/**
 * 플랫폼 운영 서비스 (job-037) — SUPER_ADMIN 전용.
 *
 * 여기의 모든 쿼리는 **의도적으로 테넌트 스코프 밖**이다. 매장 하나가 아니라 플랫폼 전체를
 * 다루기 때문이며, 그래서 전부 `runWithoutTenant` 로 감싼다. 활성 테넌트가 열린 상태
 * (SUPER_ADMIN 이 매장 하나를 들여다보다가 이 화면으로 온 경우)에서도 결과가 달라지면 안 된다.
 */
@Injectable()
export class PlatformService {
  constructor(private readonly invitationService: InvitationService) {}

  // ── 회원 ─────────────────────────────────────────────────────────────

  /**
   * 계정 발급 (job-053) — 운영자가 콘솔에서 직접 회원을 만든다.
   *
   * `AuthService.signup` 을 재사용하지 않고 별도로 두는 이유는 **약관 동의** 때문이다.
   * signup 은 필수 약관 동의를 강제하는데(auth.service.ts:63), 동의는 본인만 할 수 있는
   * 행위라 운영자가 대신 눌러주면 그 기록이 거짓이 된다. 여기서는 동의를 아예 만들지 않고
   * 미동의 상태로 계정을 만든다 — 본인이 처음 `apps/web` 에 들어오면 최초 진입
   * 게이트(`/welcome`, job-041)가 `pendingRequiredTerms` 를 보고 동의를 받는다.
   *
   * 발급된 계정은 카카오 로그인과 **이메일로 자동 연결**된다
   * (`social-auth.service.ts` 가 같은 이메일의 기존 User 에 SocialAccount 를 붙인다).
   * 즉 여기서 전화번호까지 넣어 두면, 본인이 나중에 카카오로 처음 로그인해도 같은 계정에
   * 올라타고 이미 연결된 아이·소속을 그대로 이어받는다.
   */
  async createUser(dto: CreatePlatformUserRequest) {
    const exists = await runWithoutTenant(() =>
      prisma.user.findUnique({ where: { email: dto.email } }),
    );
    if (exists) {
      throw new ConflictException("이미 가입된 이메일입니다.");
    }

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await runWithoutTenant(() =>
      prisma.user.create({
        data: {
          email: dto.email,
          nickname: dto.nickname,
          // 저장은 언제나 숫자만 (job-043). 빈 문자열은 "값 없음"과 구분되어야 한다.
          phone: dto.phone ? normalizePhone(dto.phone) : null,
          password: hashed,
          role: dto.role ?? ROLES.USER,
        },
        omit: { password: true },
      }),
    );

    // 매장이 이 번호/이메일로 미리 등록해 둔 원생·초대를 지금 소속 처리한다.
    // (개별 실패는 claimForUser 내부가 흡수한다 — 계정 발급 자체는 성공해야 한다.)
    const claimed = await this.invitationService.claimForUser(
      user.id,
      user.email,
      user.phone,
    );

    return { user, claimedInvitations: claimed.length };
  }

  /** 전 플랫폼 회원 목록 (이메일/닉네임/전화번호 검색). */
  async listUsers(query: PaginationQuery & { role?: string; status?: string }) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { nickname: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const sortField = USER_SORTABLE_FIELDS.includes(
      sort as (typeof USER_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "createdAt";

    const [items, total] = await runWithoutTenant(() =>
      prisma.$transaction([
        prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { [sortField]: order },
          omit: { password: true },
          include: { memberships: MEMBERSHIP_SUMMARY },
        }),
        prisma.user.count({ where }),
      ]),
    );

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 회원 상세 — 소속 이력 전체와 보유 개설권을 함께 보여준다. */
  async getUser(id: string) {
    const user = await runWithoutTenant(() =>
      prisma.user.findUnique({
        where: { id },
        omit: { password: true },
        include: {
          memberships: MEMBERSHIP_SUMMARY,
          userSubscriptions: {
            include: {
              plan: { select: { name: true, price: true } },
              tenant: { select: { id: true, name: true } },
            },
          },
        },
      }),
    );
    if (!user) {
      throw new NotFoundException("존재하지 않는 사용자입니다.");
    }
    return { user };
  }

  /** 계정 정지/해제. 정지된 계정은 (checkauth) 레이아웃이 로그인 이후 흐름을 막는다. */
  async updateUserStatus(actorId: string, id: string, status: string) {
    this.assertNotSelf(actorId, id, "본인 계정의 상태는 변경할 수 없습니다.");
    await this.findUserOrThrow(id);

    const user = await runWithoutTenant(() =>
      prisma.user.update({
        where: { id },
        data: { status },
        omit: { password: true },
      }),
    );
    return { user };
  }

  /**
   * 플랫폼 역할 변경 — `USER` ↔ `SUPER_ADMIN` 승격/강등.
   * 테넌트 역할(GUARDIAN/STAFF/TENANT_ADMIN)은 여기서 다루지 않는다. 그건 멤버십 소관이다.
   */
  async updateUserRole(actorId: string, id: string, role: PlatformRole) {
    // 마지막 SUPER_ADMIN 이 스스로를 강등해 플랫폼이 잠기는 것을 방지.
    this.assertNotSelf(actorId, id, "본인의 역할은 변경할 수 없습니다.");
    await this.findUserOrThrow(id);

    const user = await runWithoutTenant(() =>
      prisma.user.update({
        where: { id },
        data: { role },
        omit: { password: true },
      }),
    );
    return { user };
  }

  /**
   * 계정 삭제.
   *
   * FK 가 Cascade 라 펫·멤버십·약관동의가 함께 사라지는 파괴적 조작이다. 두 가지를 막는다:
   *   1) 본인 삭제 — 되돌릴 수 없다.
   *   2) 어떤 매장의 **마지막 ACTIVE TENANT_ADMIN** 삭제 — 그 매장이 영구히 관리자 없는 상태가 된다.
   * 정지(SUSPENDED)로 충분한 경우가 대부분이므로 UI 에서도 확인을 거치게 한다.
   */
  async deleteUser(actorId: string, id: string) {
    this.assertNotSelf(actorId, id, "본인 계정은 삭제할 수 없습니다.");
    await this.findUserOrThrow(id);

    const adminMemberships = await runWithoutTenant(() =>
      prisma.tenantMembership.findMany({
        where: {
          userId: id,
          role: ROLES.TENANT_ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
        },
        select: { tenantId: true, tenant: { select: { name: true } } },
      }),
    );

    for (const membership of adminMemberships) {
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
        throw new ConflictException(
          `'${membership.tenant.name}' 매장의 마지막 관리자입니다. 다른 관리자를 먼저 지정한 뒤 삭제해주세요.`,
        );
      }
    }

    await runWithoutTenant(() => prisma.user.delete({ where: { id } }));
    return { id };
  }

  // ── 구독 (매장 개설권 = SaaS 매출) ───────────────────────────────────

  /**
   * 전 플랫폼 개설권 구독 현황.
   * `tenantId` 가 비어 있으면 아직 매장을 열지 않은 미사용 개설권이다.
   */
  async listSeatSubscriptions(query: PaginationQuery & { status?: string }) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              {
                user: {
                  email: { contains: search, mode: "insensitive" as const },
                },
              },
              {
                tenant: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };

    const sortField = SEAT_SORTABLE_FIELDS.includes(
      sort as (typeof SEAT_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "createdAt";

    const [items, total] = await runWithoutTenant(() =>
      prisma.$transaction([
        prisma.userSubscription.findMany({
          where,
          skip,
          take,
          orderBy: { [sortField]: order },
          include: {
            user: { select: { id: true, email: true, nickname: true } },
            plan: { select: { name: true, price: true, interval: true } },
            tenant: { select: { id: true, name: true, subdomain: true } },
          },
        }),
        prisma.userSubscription.count({ where }),
      ]),
    );

    return buildPaginatedData(items, { page, pageSize, total });
  }

  // ── 내부 ─────────────────────────────────────────────────────────────

  private assertNotSelf(actorId: string, targetId: string, message: string) {
    if (actorId === targetId) {
      throw new BadRequestException(message);
    }
  }

  private async findUserOrThrow(id: string) {
    const user = await runWithoutTenant(() =>
      prisma.user.findUnique({ where: { id } }),
    );
    if (!user) {
      throw new NotFoundException("존재하지 않는 사용자입니다.");
    }
    return user;
  }
}
