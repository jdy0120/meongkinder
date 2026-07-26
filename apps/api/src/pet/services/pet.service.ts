import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import { CreatePetDto, UpdatePetDto } from "../dtos";

const PET_SORTABLE_FIELDS = ["createdAt", "name", "species"] as const;

@Injectable()
export class PetService {
  /** 반려동물 등록 */
  async create(userId: string, dto: CreatePetDto) {
    const pet = await prisma.pet.create({
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
        memo: dto.memo,
      },
    });
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

    const [items, total] = await prisma.$transaction([
      prisma.pet.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
      }),
      prisma.pet.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 반려동물 상세 조회 (본인 소유만) */
  async findOne(userId: string, id: string) {
    const pet = await prisma.pet.findFirst({ where: { id, userId } });
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }
    return { pet };
  }

  /** 반려동물 정보 수정 (본인 소유만) */
  async update(userId: string, id: string, dto: UpdatePetDto) {
    await this.findOne(userId, id);

    const pet = await prisma.pet.update({
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
        memo: dto.memo,
      },
    });
    return { pet };
  }

  /** 반려동물 삭제 (본인 소유만) */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await prisma.pet.delete({ where: { id } });
    return { id };
  }
}
