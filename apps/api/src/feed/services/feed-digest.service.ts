import { Injectable, Logger } from "@nestjs/common";
import { prisma, requireTenantId, tenantTransaction } from "@pawlog/database";
import {
  FEED_POST_STATUS,
  type FeedDigestAction,
  type FeedDigestResult,
  type RunFeedDigestResponse,
} from "@pawlog/shared";
import { ClaudeClientService } from "../../shared/llm/services/claude-client.service";
import { RunFeedDigestDto } from "../dtos";
import { startOfDay, toDateString } from "../utils/date";
import { FeedCaptionDraftService } from "./feed-caption-draft.service";

/** 리포트에 붙일 사진 수 상한 — 알림장 한 장이 스크롤 지옥이 되지 않게 한다. */
const MAX_PHOTOS_PER_REPORT = 8;

/**
 * 하루 마감 — 아이별로 오늘의 피드를 모아 일일 리포트를 자동 생성한다.
 *
 *   낮   → 선생님이 사진만 올림 (raw 피드가 실시간으로 쌓임)
 *   저녁 → 이 서비스가 아이별로 오늘 사진을 모아 요약 → 그 아이의 오늘의 알림장
 *
 * **선생님은 알림장을 한 번도 쓰지 않는다.** 이것이 판매 문장이고, 그 문장이 성립하는 지점이
 * 여기다. 기존 DailyReport 를 대체하지 않고 그대로 채워 넣으므로 보호자 화면·알림·아카이브는
 * 이미 있는 경로를 그대로 탄다.
 */
@Injectable()
export class FeedDigestService {
  private readonly logger = new Logger(FeedDigestService.name);

  constructor(
    private readonly captionDraftService: FeedCaptionDraftService,
    private readonly claude: ClaudeClientService,
  ) {}

  async run(dto: RunFeedDigestDto): Promise<RunFeedDigestResponse> {
    const date = startOfDay(dto.date);
    const tenantId = requireTenantId();

    // 발행된 게시물만 모은다 — 초안은 아직 보호자에게 보여줄 상태가 아니다.
    const posts = await prisma.feedPost.findMany({
      where: { date, status: FEED_POST_STATUS.PUBLISHED },
      include: {
        media: {
          orderBy: { order: "asc" },
          select: {
            fileId: true,
            tags: { include: { pet: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { publishedAt: "asc" },
    });

    // 아이별로 그날의 사진·캡션·함께 찍힌 친구를 모은다.
    const byPet = new Map<
      string,
      {
        petName: string;
        fileIds: string[];
        captions: string[];
        friendNames: Set<string>;
      }
    >();

    // **사진 한 장 단위로** 돈다. 게시물 단위로 모으면 그 아이가 없는 사진까지 알림장에 들어가
    // 장수도 부풀고 남의 아이 사진이 섞인다.
    for (const post of posts) {
      const caption = post.caption ?? post.aiCaptionDraft;

      for (const media of post.media) {
        const namesInPhoto = media.tags.map((tag) => tag.pet.name);

        for (const tag of media.tags) {
          const entry = byPet.get(tag.petId) ?? {
            petName: tag.pet.name,
            fileIds: [],
            captions: [],
            friendNames: new Set<string>(),
          };

          entry.fileIds.push(media.fileId);
          // 같은 게시물의 사진이 여러 장이면 캡션이 중복되므로 한 번만 담는다.
          if (caption && !entry.captions.includes(caption)) {
            entry.captions.push(caption);
          }
          // 유치원에 보내는 이유가 사회화이므로, 누구와 **같은 사진에** 있었는지가
          // 보호자가 가장 궁금해하는 정보다.
          for (const name of namesInPhoto) {
            if (name !== tag.pet.name) entry.friendNames.add(name);
          }

          byPet.set(tag.petId, entry);
        }
      }
    }

    // 아이 하나당 LLM 호출 한 번이라 순차로 돌면 원생 수에 비례해 마감이 느려진다.
    // 서로 독립적이므로 동시성 상한을 두고 함께 돌린다 (rate limit 은 상한이 막는다).
    const entries = [...byPet.entries()];
    const summaries = await this.claude.mapWithLimit(entries, ([, entry]) =>
      this.captionDraftService.generateDigest({
        petName: entry.petName,
        captions: entry.captions,
        photoCount: entry.fileIds.length,
        friendNames: [...entry.friendNames],
      }),
    );

    // 쓰기는 순차로 둔다 — 같은 트랜잭션 헬퍼를 동시에 밟게 하지 않는다.
    const results: FeedDigestResult[] = [];
    for (const [index, [petId, entry]] of entries.entries()) {
      const summary = summaries[index];

      const { id, action } = await this.upsertReport({
        tenantId,
        petId,
        date,
        summary,
        fileIds: [...new Set(entry.fileIds)].slice(0, MAX_PHOTOS_PER_REPORT),
        publish: dto.publish ?? false,
      });

      results.push({
        petId,
        petName: entry.petName,
        dailyReportId: id,
        photoCount: entry.fileIds.length,
        summary,
        action,
      });
    }

    const created = results.filter((r) => r.action === "CREATED").length;
    this.logger.log(
      `하루 마감: ${toDateString(date)} — 게시물 ${posts.length}건에서 리포트 ${created}건 생성, ${results.length - created}건 갱신했습니다.`,
    );

    return { date: toDateString(date), results };
  }

  /**
   * 그 아이의 그날 리포트를 만들거나 갱신한다.
   *
   * **재마감은 정상 동작이어야 한다.** 5시에 마감하고 6시에 사진을 더 올린 뒤 다시 마감하는 건
   * 현장에서 당연히 일어나는 일인데, 발행됐다는 이유로 통째로 건너뛰면 나중에 올린 사진이
   * 영영 알림장에 들어가지 않는다. 그래서 발행 여부가 아니라 **누가 쓴 리포트인가**로 가른다:
   *
   *   authorId 없음(피드가 만든 것) → AI 초안과 사진을 최신 피드로 다시 채운다
   *   authorId 있음(사람이 쓴 것)   → 사진·총평은 그대로 두고 AI 초안만 갱신한다
   *
   * 사람이 쓴 `summary` 는 어느 경우에도 건드리지 않는다 — 보호자가 이미 읽은 글이
   * 소리 없이 바뀌면 안 된다. 한 번 발행된 리포트를 DRAFT 로 되돌리지도 않는다.
   */
  private async upsertReport(params: {
    tenantId: string;
    petId: string;
    date: Date;
    summary: string;
    fileIds: string[];
    publish: boolean;
  }): Promise<{ id: string; action: FeedDigestAction }> {
    const { tenantId, petId, date, summary, fileIds, publish } = params;

    const existing = await prisma.dailyReport.findFirst({
      where: { petId, date },
      select: { id: true, status: true, authorId: true },
    });

    // 오늘 출석 기록이 있으면 리포트를 거기에 연결한다 (기존 하원+리포트 알림 경로가 이를 탄다).
    const attendance = await prisma.attendance.findFirst({
      where: { petId, date },
      select: { id: true, dailyReport: { select: { id: true } } },
    });
    const attendanceId =
      attendance && !attendance.dailyReport ? attendance.id : undefined;

    const contents = fileIds.map((fileId, index) => ({
      tenantId,
      type: "PHOTO",
      fileId,
      order: index,
    }));

    return tenantTransaction(prisma, async (tx) => {
      if (existing) {
        // 한 번 발행된 리포트는 다시 DRAFT 로 내리지 않는다.
        const status =
          existing.status === "PUBLISHED" || publish ? "PUBLISHED" : "DRAFT";
        // 선생님이 직접 만든 리포트에는 피드가 사진을 끼워 넣지 않는다.
        const writtenByPerson = Boolean(existing.authorId);

        const updated = await tx.dailyReport.update({
          where: { id: existing.id },
          data: {
            aiCommentDraft: summary,
            status,
            attendanceId,
            // nested write 는 Prisma Extension 자동 주입 대상이 아니므로 tenantId 를 직접 채운다.
            contents: writtenByPerson
              ? undefined
              : { deleteMany: { type: "PHOTO" }, create: contents },
          },
          select: { id: true },
        });
        return {
          id: updated.id,
          action: writtenByPerson
            ? ("DRAFT_ONLY" as const)
            : ("UPDATED" as const),
        };
      }

      const created = await tx.dailyReport.create({
        data: {
          tenantId,
          petId,
          date,
          attendanceId,
          aiCommentDraft: summary,
          status: publish ? "PUBLISHED" : "DRAFT",
          contents: { create: contents },
        },
        select: { id: true },
      });
      return { id: created.id, action: "CREATED" as const };
    });
  }
}
