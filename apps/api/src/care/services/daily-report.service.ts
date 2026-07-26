import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import { CreateDailyReportDto, UpdateDailyReportDto } from "../dtos";

const DAILY_REPORT_SORTABLE_FIELDS = ["createdAt", "date"] as const;

@Injectable()
export class DailyReportService {
  /** 일일 리포트 작성 */
  async create(dto: CreateDailyReportDto) {
    const pet = await prisma.pet.findUnique({ where: { id: dto.petId } });
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }

    const dailyReport = await prisma.dailyReport.create({
      data: {
        petId: dto.petId,
        attendanceId: dto.attendanceId,
        date: new Date(dto.date),
        summary: dto.summary,
        status: dto.status,
      },
    });
    return { dailyReport };
  }

  /** 일일 리포트 목록 (petId 필터 + 페이지네이션·정렬) */
  async findAll(query: PaginationQuery & { petId?: string }) {
    const { page, pageSize, skip, take, order, sort } =
      resolvePagination(query);

    const where = query.petId ? { petId: query.petId } : {};

    const sortField = DAILY_REPORT_SORTABLE_FIELDS.includes(
      sort as (typeof DAILY_REPORT_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "date";

    const [items, total] = await prisma.$transaction([
      prisma.dailyReport.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: { contents: true },
      }),
      prisma.dailyReport.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 일일 리포트 상세 조회 (항목 포함) */
  async findOne(id: string) {
    const dailyReport = await prisma.dailyReport.findUnique({
      where: { id },
      include: { contents: true },
    });
    if (!dailyReport) {
      throw new NotFoundException("존재하지 않는 일일 리포트입니다.");
    }
    return { dailyReport };
  }

  /** 일일 리포트 수정 */
  async update(id: string, dto: UpdateDailyReportDto) {
    await this.findOne(id);

    const dailyReport = await prisma.dailyReport.update({
      where: { id },
      data: {
        attendanceId: dto.attendanceId,
        date: dto.date ? new Date(dto.date) : undefined,
        summary: dto.summary,
        status: dto.status,
      },
    });
    return { dailyReport };
  }

  /** 일일 리포트 삭제 */
  async remove(id: string) {
    await this.findOne(id);
    await prisma.dailyReport.delete({ where: { id } });
    return { id };
  }
}
