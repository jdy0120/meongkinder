import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import { CreateAttendanceDto, UpdateAttendanceDto } from "../dtos";

const ATTENDANCE_SORTABLE_FIELDS = ["createdAt", "date"] as const;

@Injectable()
export class AttendanceService {
  /** 출석 기록 등록 */
  async create(dto: CreateAttendanceDto) {
    const pet = await prisma.pet.findUnique({ where: { id: dto.petId } });
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }

    const attendance = await prisma.attendance.create({
      data: {
        petId: dto.petId,
        date: new Date(dto.date),
        status: dto.status,
      },
    });
    return { attendance };
  }

  /** 출석 기록 목록 (petId 필터 + 페이지네이션·정렬) */
  async findAll(query: PaginationQuery & { petId?: string }) {
    const { page, pageSize, skip, take, order, sort } =
      resolvePagination(query);

    const where = query.petId ? { petId: query.petId } : {};

    const sortField = ATTENDANCE_SORTABLE_FIELDS.includes(
      sort as (typeof ATTENDANCE_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "date";

    const [items, total] = await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
      }),
      prisma.attendance.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 출석 기록 상세 조회 */
  async findOne(id: string) {
    const attendance = await prisma.attendance.findUnique({ where: { id } });
    if (!attendance) {
      throw new NotFoundException("존재하지 않는 출석 기록입니다.");
    }
    return { attendance };
  }

  /** 출석 기록 수정 (등/하원 시각·상태) */
  async update(id: string, dto: UpdateAttendanceDto) {
    await this.findOne(id);

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        status: dto.status,
        checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : undefined,
        checkOutAt: dto.checkOutAt ? new Date(dto.checkOutAt) : undefined,
      },
    });
    return { attendance };
  }

  /** 출석 기록 삭제 */
  async remove(id: string) {
    await this.findOne(id);
    await prisma.attendance.delete({ where: { id } });
    return { id };
  }
}
