import { Injectable } from "@nestjs/common";
import { prisma } from "@pawlog/database";
import type { FeedCoveragePet, FeedCoverageResponse } from "@pawlog/shared";
import { startOfDay, toDateString } from "../utils/date";
import { scheduledOn } from "../../shared/utils";

/** 오늘 매장에 있는 것으로 간주하는 출석 상태 (결석·취소는 사진이 없어도 정상이다) */
const PRESENT_STATUSES = ["SCHEDULED", "CHECKED_IN", "CHECKED_OUT", "MAKEUP"];

/**
 * "오늘 사진 0장인 아이" 집계 — 피드 구조의 필수 방어 장치.
 *
 * 폼 기반 알림장은 20마리를 순서대로 채우니 누락이 구조적으로 없다. 피드는 반대로 **안 찍히면
 * 그냥 빠진다.** 그 자유도의 대가를 시스템이 메워야 하고, 이 집계가 없으면 "우리 애만 사진이
 * 없다"는 클레임이 그대로 터진다 — 편해지라고 판 제품이 컴플레인을 늘리면 해지 사유가 된다.
 */
@Injectable()
export class FeedCoverageService {
  async findCoverage(dateInput?: string): Promise<FeedCoverageResponse> {
    const date = startOfDay(dateInput);

    // 오늘 있을 아이 = 출석 기록이 있거나 스케줄(요일 반복/날짜 지정)에 걸린 이용중 원생.
    const pets = await prisma.pet.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          {
            attendances: {
              some: { date, status: { in: PRESENT_STATUSES } },
            },
          },
          scheduledOn(date),
        ],
      },
      select: { id: true, name: true, profileImageFileId: true },
      orderBy: { name: "asc" },
    });

    // 발행 여부와 무관하게 센다 — 마감 전에 채워 넣으라고 알려주는 화면이므로
    // 초안(DRAFT)에 담긴 사진도 "이미 찍혔다"로 봐야 한다.
    const tagCounts = await prisma.feedTag.groupBy({
      by: ["petId"],
      where: { post: { date } },
      _count: { _all: true },
    });
    const countByPetId = new Map(
      tagCounts.map((row) => [row.petId, row._count._all]),
    );

    const postCount = await prisma.feedPost.count({ where: { date } });

    const missing: FeedCoveragePet[] = [];
    const covered: FeedCoveragePet[] = [];

    for (const pet of pets) {
      const photoCount = countByPetId.get(pet.id) ?? 0;
      const row: FeedCoveragePet = {
        petId: pet.id,
        petName: pet.name,
        profileImageFileId: pet.profileImageFileId,
        photoCount,
      };
      (photoCount === 0 ? missing : covered).push(row);
    }

    return {
      date: toDateString(date),
      missing,
      covered,
      totalPets: pets.length,
      postCount,
    };
  }
}
