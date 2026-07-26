import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import {
  CreateSubscriptionLedgerDto,
  UpdateSubscriptionLedgerDto,
} from "../dtos";

@Injectable()
export class SubscriptionLedgerService {
  /** 정기권/회수권 변동 내역 생성 (수동 보정용) */
  async create(dto: CreateSubscriptionLedgerDto) {
    const ledger = await prisma.subscriptionLedger.create({
      data: {
        userId: dto.userId,
        subscriptionId: dto.subscriptionId,
        attendanceId: dto.attendanceId,
        type: dto.type,
        amount: dto.amount,
        balanceAfter: dto.balanceAfter,
        description: dto.description,
      },
    });
    return { ledger };
  }

  /** 변동 내역 목록 (userId 필터 + 페이지네이션) */
  async findAll(query: PaginationQuery & { userId?: string }) {
    const { page, pageSize, skip, take, order } = resolvePagination(query);

    const where = query.userId ? { userId: query.userId } : {};

    const [items, total] = await prisma.$transaction([
      prisma.subscriptionLedger.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: order },
      }),
      prisma.subscriptionLedger.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 나의 정기권/회수권 사용 내역 */
  async findMine(userId: string, query: PaginationQuery) {
    return this.findAll({ ...query, userId });
  }

  /** 변동 내역 상세 조회 */
  async findOne(id: string) {
    const ledger = await prisma.subscriptionLedger.findUnique({
      where: { id },
    });
    if (!ledger) {
      throw new NotFoundException("존재하지 않는 정기권/회수권 내역입니다.");
    }
    return { ledger };
  }

  /** 변동 내역 수정 (수동 보정용) */
  async update(id: string, dto: UpdateSubscriptionLedgerDto) {
    await this.findOne(id);

    const ledger = await prisma.subscriptionLedger.update({
      where: { id },
      data: {
        subscriptionId: dto.subscriptionId,
        attendanceId: dto.attendanceId,
        type: dto.type,
        amount: dto.amount,
        balanceAfter: dto.balanceAfter,
        description: dto.description,
      },
    });
    return { ledger };
  }

  /** 변동 내역 삭제 */
  async remove(id: string) {
    await this.findOne(id);
    await prisma.subscriptionLedger.delete({ where: { id } });
    return { id };
  }
}
