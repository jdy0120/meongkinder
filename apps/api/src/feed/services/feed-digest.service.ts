import { Injectable, Logger } from "@nestjs/common";
import { prisma, requireTenantId, tenantTransaction } from "@pawlog/database";
import {
  FEED_POST_STATUS,
  type FeedDigestAction,
  type FeedDigestEmptyReason,
  type FeedDigestResult,
  type RunFeedDigestResponse,
} from "@pawlog/shared";
import { ClaudeClientService } from "../../shared/llm/services/claude-client.service";
import { ResponseEnvelope } from "../../shared/dtos";
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

  async run(dto: RunFeedDigestDto) {
    const date = startOfDay(dto.date);
    const tenantId = requireTenantId();

    // 발행된 게시물만 모은다 — 초안은 아직 보호자에게 보여줄 상태가 아니다.
    //
    // job-062: 알림장에서 파생된 미러 게시물은 제외한다. 마감의 입력으로 되먹이면 그 사진이
    // 다시 알림장으로 들어가 장수·`publishedPostCount` 가 부풀고, 마감 결과가 실제로 찍은
    // 사진 수보다 큰 숫자를 말하게 된다.
    const posts = await prisma.feedPost.findMany({
      where: {
        date,
        status: FEED_POST_STATUS.PUBLISHED,
        sourceDailyReportId: null,
      },
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

    const { emptyReason, draftPostCount } = await this.explainEmptyResult(
      date,
      posts.length,
      results.length,
    );

    if (emptyReason) {
      this.logger.warn(
        `하루 마감: ${toDateString(date)} — 만들어진 리포트가 없습니다 (사유 ${emptyReason}, 발행 ${posts.length}건 / 초안 ${draftPostCount}건).`,
      );
    }

    const payload: RunFeedDigestResponse = {
      date: toDateString(date),
      results,
      emptyReason,
      publishedPostCount: posts.length,
      draftPostCount,
    };

    // ⚠️ 성공 메시지를 라우트의 `@ResponseMessage` 고정값으로 두면 **0건일 때도
    // "알림장이 만들어졌습니다" 라고 말한다.** 화면이 토스트를 따로 그려도 응답 자체가
    // 거짓이면 로그·연동·다른 클라이언트가 전부 속는다. 실행 결과에 따라 달라지는
    // 문구이므로 CLAUDE.md §6 대로 서비스가 envelope 으로 직접 정한다.
    return new ResponseEnvelope(
      payload,
      emptyReason
        ? "만들어진 알림장이 없습니다."
        : `알림장 ${results.length}건을 처리했습니다.`,
    );
  }

  /**
   * 결과가 비었을 때 **왜** 비었는지 가른다.
   *
   * 마감은 "발행된 사진에 태그된 아이"만 대상으로 하므로, 태그가 하나도 없으면 예외 없이
   * 조용히 0건으로 끝난다. 그 침묵을 그대로 두면 화면은 "사진을 올려주세요" 같은 한 마디로
   * 뭉갤 수밖에 없고, 이미 사진을 올린 사람은 엉뚱한 곳을 다시 확인하게 된다.
   * (job-060 의 `blockedBy` 와 같은 판단 — 막힌 이유를 합치면 "이용권을 방금 산 사람에게
   * 이용권이 없다고 말하는" 상황이 된다.)
   *
   * 초안 수는 **결과가 비었을 때만** 센다 — 정상 경로에 쿼리를 하나 더 얹지 않는다.
   */
  private async explainEmptyResult(
    date: Date,
    publishedPostCount: number,
    resultCount: number,
  ): Promise<{
    emptyReason?: FeedDigestEmptyReason;
    draftPostCount: number;
  }> {
    if (resultCount > 0) return { draftPostCount: 0 };

    const draftPostCount = await prisma.feedPost.count({
      where: { date, status: FEED_POST_STATUS.DRAFT },
    });

    // 발행된 게시물이 있는데 결과가 0 이면 원인은 태그뿐이다 — 사진은 있고 아이만 없다.
    if (publishedPostCount > 0)
      return { emptyReason: "NO_TAGS", draftPostCount };
    if (draftPostCount > 0) return { emptyReason: "ALL_DRAFT", draftPostCount };
    return { emptyReason: "NO_POSTS", draftPostCount };
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
