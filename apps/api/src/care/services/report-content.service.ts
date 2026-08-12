import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma, requireTenantId, tenantTransaction } from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import { CreateReportContentDto, UpdateReportContentDto } from "../dtos";

const REPORT_CONTENT_SORTABLE_FIELDS = ["createdAt", "order"] as const;

@Injectable()
export class ReportContentService {
  /** 리포트 항목 추가 */
  async create(dailyReportId: string, dto: CreateReportContentDto) {
    const dailyReport = await prisma.dailyReport.findUnique({
      where: { id: dailyReportId },
    });
    if (!dailyReport) {
      throw new NotFoundException("존재하지 않는 일일 리포트입니다.");
    }

    const reportContent = await prisma.reportContent.create({
      data: {
        tenantId: requireTenantId(),
        dailyReportId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        fileId: dto.fileId,
        order: dto.order ?? 0,
      },
    });
    return { reportContent };
  }

  /** 리포트 항목 목록 (페이지네이션·정렬) */
  async findAll(dailyReportId: string, query: PaginationQuery) {
    const { page, pageSize, skip, take, order, sort } =
      resolvePagination(query);

    const where = { dailyReportId };

    const sortField = REPORT_CONTENT_SORTABLE_FIELDS.includes(
      sort as (typeof REPORT_CONTENT_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "order";

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.reportContent.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
      });
      const total = await tx.reportContent.count({ where });
      return [items, total] as const;
    });

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 리포트 항목 상세 조회 */
  async findOne(dailyReportId: string, id: string) {
    const reportContent = await prisma.reportContent.findFirst({
      where: { id, dailyReportId },
    });
    if (!reportContent) {
      throw new NotFoundException("존재하지 않는 리포트 항목입니다.");
    }
    return { reportContent };
  }

  /** 리포트 항목 수정 */
  async update(dailyReportId: string, id: string, dto: UpdateReportContentDto) {
    await this.findOne(dailyReportId, id);

    const reportContent = await prisma.reportContent.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        content: dto.content,
        fileId: dto.fileId,
        order: dto.order,
      },
    });
    return { reportContent };
  }

  /** 리포트 항목 삭제 */
  async remove(dailyReportId: string, id: string) {
    await this.findOne(dailyReportId, id);
    await prisma.reportContent.delete({ where: { id } });
    return { id };
  }
}
