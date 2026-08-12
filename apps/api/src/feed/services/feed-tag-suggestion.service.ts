import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@pawlog/database";
import {
  FEED_TAG_CONFIDENCE_THRESHOLD,
  type FeedTagSuggestion,
} from "@pawlog/shared";
import { startOfDay } from "../utils/date";
import { scheduledOn } from "../../shared/utils";

interface SuggestParams {
  fileIds: string[];
  date?: string;
}

/**
 * 사진에 등장한 아이 태그 제안.
 *
 * 이 기획의 승부처는 인식 정확도 자체가 아니라 **후보를 좁히는 구조**다. 전체 견종 DB 매칭이
 * 아니라 "오늘 등원한 20마리 중 누구냐"는 20지선다이고, 그래서 실현 가능성이 생긴다.
 * 그 후보 축소가 여기서 일어난다.
 *
 * ⚠️ 실제 얼굴 인식 모델은 아직 붙어 있지 않다.
 *   - 지금은 **오늘 출석/스케줄이라는 사전 확률(prior)** 로만 후보를 정렬한다. 사진 픽셀은 보지 않는다.
 *   - 따라서 모든 제안의 needsConfirmation 은 true 다 — 화면은 항상 사람 확인을 받는다.
 *     (인스타도 얼굴 태그는 제안만 한다. 목표는 100% 가 아니라 "손으로 다 태그하는 것보다 빠른 것".)
 *   - 사람이 고친 내역은 FeedTagCorrection 에 쌓이므로, 모델을 붙이는 시점에 그대로 학습·평가
 *     데이터가 된다. 아래 `// TODO(vision)` 지점이 모델 호출을 끼울 자리다.
 */
@Injectable()
export class FeedTagSuggestionService {
  private readonly logger = new Logger(FeedTagSuggestionService.name);

  /** 오늘 이 매장에 있을 아이들 — 출석 기록이 있거나 스케줄에 걸린 이용중 원생 */
  private async findCandidatePets(date: Date) {
    return prisma.pet.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          {
            attendances: {
              some: {
                date,
                status: {
                  in: ["SCHEDULED", "CHECKED_IN", "CHECKED_OUT", "MAKEUP"],
                },
              },
            },
          },
          scheduledOn(date),
        ],
      },
      select: {
        id: true,
        name: true,
        profileImageFileId: true,
        photoConsent: true,
        attendances: {
          where: { date },
          select: { status: true, checkInAt: true },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async suggest(params: SuggestParams) {
    const date = startOfDay(params.date);
    const pets = await this.findCandidatePets(date);

    // TODO(vision): 여기서 params.fileIds 의 이미지를 얼굴 인식 모델에 넘겨
    // petId 별 확신도를 받아온다. 그때 아래 prior 는 tie-breaker 로 내려간다.
    this.logger.debug(
      `태그 제안: 사진 ${params.fileIds.length}장, 후보 ${pets.length}마리 (얼굴 인식 미적용 — 출석 prior 기준 정렬)`,
    );

    const toSuggestion = (
      pet: (typeof pets)[number],
      confidence: number,
    ): FeedTagSuggestion => ({
      petId: pet.id,
      petName: pet.name,
      profileImageFileId: pet.profileImageFileId,
      confidence,
      // 얼굴 인식이 붙기 전까지는 어떤 제안도 사람 확인 없이 통과시키지 않는다.
      needsConfirmation: true,
      photoConsent: pet.photoConsent,
    });

    const candidates = pets.map((pet) =>
      toSuggestion(pet, this.priorConfidence(pet)),
    );

    // 등원 체크까지 끝난 아이는 "지금 여기 있는 것이 확실한" 아이라 위로 올린다.
    const suggestions = [...candidates]
      .filter((candidate) => candidate.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    return { suggestions, candidates };
  }

  /**
   * 사진을 보지 않고 낼 수 있는 사전 확률.
   * 등원 체크됨 > 오늘 출석 예정 > 요일 스케줄만 걸림 순.
   * 임계값(FEED_TAG_CONFIDENCE_THRESHOLD)을 넘기지 않도록 의도적으로 낮게 잡는다 —
   * 이 값은 "사진 속에 있다"는 근거가 아니라 "오늘 매장에 있다"는 근거일 뿐이기 때문이다.
   */
  private priorConfidence(pet: {
    attendances: { status: string; checkInAt: Date | null }[];
  }) {
    const attendance = pet.attendances[0];
    const ceiling = FEED_TAG_CONFIDENCE_THRESHOLD - 0.1;

    if (!attendance) return Math.min(0.3, ceiling);
    if (attendance.checkInAt) return Math.min(0.6, ceiling);
    if (attendance.status === "SCHEDULED") return Math.min(0.45, ceiling);
    return Math.min(0.3, ceiling);
  }
}
