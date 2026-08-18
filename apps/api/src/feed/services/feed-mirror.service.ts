import { Injectable, Logger } from "@nestjs/common";
import { prisma, requireTenantId, tenantTransaction } from "@pawlog/database";
import { FEED_POST_STATUS, FEED_TAG_SOURCE } from "@pawlog/shared";

/**
 * 알림장 → 피드 미러링 (job-062).
 *
 * ## 왜 입력구를 하나로 합치지 않았나
 *
 * 피드는 "사진 한 장에 여러 아이"라 빠르지만 **안 찍힌 아이는 그냥 빠진다.** 알림장은 반대로
 * 아이 단위라 누가 비었는지가 구조적으로 드러난다. 두 축이 서로를 보완하므로 입력구는 둘 다
 * 남기고, **없앨 것은 입력구가 아니라 비대칭**이다 — 알림장에 올린 사진이 피드에는 존재하지
 * 않아서 보호자 피드에도 안 뜨고 "오늘 사진 0장" 집계에도 안 잡히던 것.
 *
 * ## 미러는 알림을 보내지 않는다
 *
 * 알림장 발행은 이미 `CHECK_OUT_REPORT` 알림톡을 보낸다. 여기서 피드 팬아웃까지 돌면 같은
 * 사진으로 보호자에게 **두 건**이 가고 건당 원가도 두 배다. `hasSentToday` 는 `type` 별로
 * 세기 때문에 이 둘을 서로 막아 주지 못한다. 그래서 `FeedPostService` 를 거치지 않고
 * prisma 로 직접 쓴다 — 그 서비스는 발행 시 무조건 팬아웃을 부른다.
 *
 * ## 출석 기록도 만들지 않는다
 *
 * 피드 발행은 "태그 = 오늘 여기 있었다"이므로 출석을 파생시키지만, 알림장은 이미 자기
 * `attendanceId` 로 출석과 연결돼 있다. 여기서 또 만들면 같은 사실이 두 경로로 들어와
 * 어긋날 자리만 는다.
 *
 * ## 초상권
 *
 * 미러는 **사진 한 장에 아이 한 명**이다. PRIVATE("본인 보호자만")가 막는 것은 *다른 아이와
 * 함께 찍힌* 사진이므로(`FeedPostService.assertConsentAllowsPublish`), 구조적으로 위반이
 * 불가능하다. 팬아웃 대상도 그 아이의 보호자 한 명뿐이라 알림장과 수신자가 같다.
 */
@Injectable()
export class FeedMirrorService {
  private readonly logger = new Logger(FeedMirrorService.name);

  /**
   * 알림장 하나의 사진을 피드 미러 게시물에 반영한다 (생성/갱신/삭제).
   *
   * 알림장 수정은 `report_contents` 를 통째로 갈아엎으므로, 미러도 **매번 현재 상태로 다시
   * 맞춘다.** 갱신 대상은 `FeedPost.sourceDailyReportId`(UNIQUE)로 찾는다 — 이 고리가 없으면
   * 알림장을 고칠 때마다 게시물이 하나씩 쌓인다.
   */
  async sync(dailyReportId: string): Promise<void> {
    const report = await prisma.dailyReport.findUnique({
      where: { id: dailyReportId },
      select: {
        id: true,
        petId: true,
        date: true,
        status: true,
        summary: true,
        authorId: true,
        contents: {
          where: { type: "PHOTO" },
          select: { fileId: true, order: true },
          orderBy: { order: "asc" },
        },
        mirroredFeedPost: { select: { id: true, status: true } },
      },
    });
    if (!report) return;

    // 같은 사진을 두 항목이 가리킬 수 있다(항목 순서를 바꿔 저장하는 경우). FeedMedia 는
    // 사진 단위이므로 중복을 접는다.
    const fileIds = [
      ...new Set(
        report.contents
          .map((content) => content.fileId)
          .filter((fileId): fileId is string => Boolean(fileId)),
      ),
    ];

    // 사진이 하나도 없으면 미러가 존재할 근거가 없다. 사진을 전부 지운 수정도 여기로 온다.
    if (fileIds.length === 0) {
      if (report.mirroredFeedPost) {
        await prisma.feedPost.delete({
          where: { id: report.mirroredFeedPost.id },
        });
      }
      return;
    }

    const tenantId = requireTenantId();

    // 알림장이 발행되지 않았으면 미러도 초안이다. **여기가 제일 위험한 지점** — 묶지 않으면
    // 검수 전 알림장 사진이 보호자 피드에 그대로 새어 나가고, 그건 되돌릴 수 없다.
    // 다만 한 번 발행된 게시물을 초안으로 되돌리지는 않는다(알림장 쪽 규칙과 같다).
    const alreadyPublished =
      report.mirroredFeedPost?.status === FEED_POST_STATUS.PUBLISHED;
    const shouldPublish = report.status === "PUBLISHED" || alreadyPublished;
    const status = shouldPublish
      ? FEED_POST_STATUS.PUBLISHED
      : FEED_POST_STATUS.DRAFT;

    // 사진(FeedMedia)의 id 가 있어야 태그를 달 수 있어 두 단계로 나뉜다 — FeedPostService 의
    // 작성 경로와 같은 이유·같은 순서다.
    // ⚠️ 중첩 create 는 Prisma Extension 의 tenantId 자동 주입 대상이 아니므로 직접 채운다.
    const mediaData = fileIds.map((fileId, index) => ({
      tenantId,
      fileId,
      order: index,
    }));

    await tenantTransaction(prisma, async (tx) => {
      let postId: string;

      if (report.mirroredFeedPost) {
        postId = report.mirroredFeedPost.id;
        // 사진 목록은 통째로 다시 만든다(알림장 수정이 항목을 통째로 갈아엎으므로).
        // 태그는 FeedMedia 에 CASCADE 로 딸려 지워진다.
        await tx.feedMedia.deleteMany({ where: { postId } });
        await tx.feedPost.update({
          where: { id: postId },
          data: {
            date: report.date,
            caption: report.summary,
            status,
            publishedAt:
              shouldPublish && !alreadyPublished ? new Date() : undefined,
            media: { create: mediaData },
          },
        });
      } else {
        const created = await tx.feedPost.create({
          data: {
            tenantId,
            sourceDailyReportId: report.id,
            authorId: report.authorId,
            date: report.date,
            caption: report.summary,
            status,
            publishedAt: shouldPublish ? new Date() : null,
            media: { create: mediaData },
          },
          select: { id: true },
        });
        postId = created.id;
      }

      const media = await tx.feedMedia.findMany({
        where: { postId },
        select: { id: true },
      });

      await tx.feedTag.createMany({
        data: media.map((item) => ({
          tenantId,
          postId,
          mediaId: item.id,
          petId: report.petId,
          // 사람이 알림장에 직접 넣은 사진이므로 확인된 태그다(AI 제안이 아니다).
          source: FEED_TAG_SOURCE.MANUAL,
          confirmed: true,
        })),
        skipDuplicates: true,
      });
    });
  }

  /**
   * 알림장 저장 경로에서 부르는 래퍼 — 미러 실패가 알림장 저장을 되돌리지 않게 한다.
   *
   * 미러는 파생 데이터다. 여기서 예외를 그대로 올리면 알림장은 이미 커밋된 뒤라 API 만 500 이
   * 되고, 원장은 저장이 안 된 줄 알고 다시 눌러 **같은 알림장을 두 번 만든다.** 대신 실패를
   * 로그로 남긴다 — 다음 수정에서 다시 맞춰진다.
   */
  async syncQuietly(dailyReportId: string): Promise<void> {
    try {
      await this.sync(dailyReportId);
    } catch (error) {
      this.logger.error(
        `알림장 → 피드 미러 반영에 실패했습니다. dailyReportId=${dailyReportId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
