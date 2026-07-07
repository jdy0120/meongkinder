import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@template/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
  type Role,
  type UpdateUserRequest,
} from "@template/shared";

const USER_SORTABLE_FIELDS = [
  "createdAt",
  "email",
  "nickname",
  "role",
] as const;

@Injectable()
export class AdminService {
  /** 사용자 목록 (공통 페이지네이션 유틸 사용) */
  async listUsers(query: PaginationQuery) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { nickname: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const sortField = USER_SORTABLE_FIELDS.includes(
      sort as (typeof USER_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "createdAt";

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: {
          termsAgreements: {
            include: {
              terms: true,
            },
            orderBy: {
              agreedAt: "desc",
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 사용자 역할 변경 (승격/강등) — ADMIN 전용 */
  async updateUserRole(id: string, role: Role) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException("존재하지 않는 사용자입니다.");
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
    });

    return { message: "역할이 변경되었습니다.", user };
  }

  /** 사용자 정보 수정 (닉네임·계정 상태) — ADMIN 전용. 전달된 필드만 부분 수정. */
  async updateUser(id: string, dto: UpdateUserRequest) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException("존재하지 않는 사용자입니다.");
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    return { message: "사용자 정보가 수정되었습니다.", user };
  }

  /** 구독 목록 (페이지네이션·정렬·검색) */
  async listSubscriptions(query: PaginationQuery) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = search
      ? {
          user: {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { nickname: { contains: search, mode: "insensitive" as const } },
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

    const [items, total] = await prisma.$transaction([
      prisma.userSubscription.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: {
          user: {
            select: {
              email: true,
              nickname: true,
            },
          },
          plan: true,
        },
      }),
      prisma.userSubscription.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }
}
