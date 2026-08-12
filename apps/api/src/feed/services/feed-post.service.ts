import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  prisma,
  Prisma,
  requireTenantId,
  runWithoutTenant,
  tenantTransaction,
  type ExtendedTransactionClient,
} from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  FEED_POST_STATUS,
  FEED_TAG_CORRECTION_ACTION,
  FEED_TAG_SOURCE,
  PHOTO_CONSENT,
  type PaginationQuery,
} from "@pawlog/shared";
import { FileService } from "../../shared/file/services/file.service";
import {
  ensureScheduledAttendance,
  resolveGuardianPhone,
} from "../../shared/utils";
import {
  CreateFeedPostDto,
  CreateFeedTagDto,
  UpdateFeedPostDto,
} from "../dtos";
import { startOfDay } from "../utils/date";
import { FeedCaptionDraftService } from "./feed-caption-draft.service";
import { FeedNotificationService } from "./feed-notification.service";

const PET_SELECT = {
  id: true,
  name: true,
  profileImageFileId: true,
  photoConsent: true,
} as const;

/**
 * 상세/목록 응답의 공통 include — FeedPostDetail 계약과 1:1로 맞춰 둔다.
 *
 * 태그는 **사진에 붙어 있다**. 게시물의 `tags` 는 화면 상단 요약 칩을 위한 합집합일 뿐이고,
 * 누가 어느 사진에 있는지는 `media[].tags` 가 답한다.
 */
const POST_INCLUDE = {
  media: {
    orderBy: { order: "asc" },
    include: {
      file: { select: { id: true, originalName: true, mimeType: true } },
      tags: { include: { pet: { select: PET_SELECT } } },
    },
  },
  tags: { include: { pet: { select: PET_SELECT } } },
  author: { select: { id: true, nickname: true } },
} satisfies Prisma.FeedPostInclude;

/**
 * 보호자 피드 전용 include.
 * "이 태그가 내 아이인가"를 판정하려면 pet.userId 가 필요하다. 응답 계약(FeedPostDetail)에는
 * 없는 필드이므로 서비스에서 걷어낸 뒤 내보낸다.
 */
const OWNER_PET_SELECT = { ...PET_SELECT, userId: true } as const;

const OWNER_POST_INCLUDE = {
  media: {
    orderBy: { order: "asc" },
    include: {
      file: { select: { id: true, originalName: true, mimeType: true } },
      tags: { include: { pet: { select: OWNER_PET_SELECT } } },
    },
  },
  tags: { include: { pet: { select: OWNER_PET_SELECT } } },
  author: { select: { id: true, nickname: true } },
} satisfies Prisma.FeedPostInclude;

const FEED_SORTABLE_FIELDS = ["createdAt", "date"] as const;

@Injectable()
export class FeedPostService {
  constructor(
    private readonly fileService: FileService,
    private readonly captionDraftService: FeedCaptionDraftService,
    private readonly feedNotificationService: FeedNotificationService,
  ) {}

  // ── 공통 헬퍼 ──────────────────────────────────────────────────────────

  /** 임시 업로드(v1/file) 파일을 영구 저장소로 이동 (v1/file 모듈 재사용) */
  private async moveMediaTemps(
    fileIds: string[],
    dateKey: string,
    tx: ExtendedTransactionClient,
  ) {
    if (fileIds.length === 0) return;

    await this.fileService.moveTempsToUploads({
      fileList: fileIds.map((id) => ({ id })),
      domain: "feed",
      newPath: dateKey,
      tx,
    });
  }

  /** 태그 대상 펫이 모두 이 매장의 원생인지 확인하고 이름/동의범위를 함께 가져온다 */
  private async loadTaggedPets(petIds: string[]) {
    if (petIds.length === 0) return [];

    const pets = await prisma.pet.findMany({
      where: { id: { in: petIds } },
      select: {
        id: true,
        name: true,
        userId: true,
        guardianPhone: true,
        // 계정 전화번호 폴백용 (resolveGuardianPhone). 보호자가 앱에서 직접 등록한 아이는
        // guardianPhone 이 비어 있기 쉬워, 이게 없으면 팬아웃이 조용히 누락된다.
        user: { select: { phone: true } },
        photoConsent: true,
      },
    });

    if (pets.length !== petIds.length) {
      throw new NotFoundException(
        "존재하지 않거나 이 매장의 원생이 아닌 반려동물이 태그에 포함되어 있습니다.",
      );
    }
    return pets;
  }

  /**
   * 초상권 동의 검사 — 발행 직전 마지막 방어선.
   *
   * **사진 한 장 단위로** 본다. PRIVATE 는 "본인 보호자만"이므로 그 아이가 다른 아이와 **같은
   * 사진에** 찍혔다면 배포할 곳이 없다. 게시물 단위로 보면 "초코만 있는 사진 + 몽이만 있는
   * 사진"을 한 번에 올리는 정상적인 경우까지 막게 된다.
   *
   * 조용히 안 보이게 하면 선생님은 올렸다고 믿고 보호자는 못 받는 최악의 실패가 되므로,
   * 발행 시점에 명시적으로 막고 어떤 아이 때문인지 알려준다.
   */
  private assertConsentAllowsPublish(
    petsByFileId: Map<
      string,
      { id: string; name: string; photoConsent: string }[]
    >,
  ) {
    for (const pets of petsByFileId.values()) {
      if (pets.length <= 1) continue;

      const restricted = pets.filter(
        (pet) => pet.photoConsent === PHOTO_CONSENT.PRIVATE,
      );
      if (restricted.length === 0) continue;

      const names = restricted.map((pet) => pet.name).join(", ");
      throw new BadRequestException(
        `${names}은(는) 초상권 동의 범위가 '본인 보호자만'이라 다른 아이와 함께 찍힌 사진에 태그할 수 없습니다. 해당 아이는 혼자 나온 사진에만 태그해주세요.`,
      );
    }
  }

  /** 태그를 사진(fileId)별로 묶는다 — 동의 검사와 태그 생성이 모두 이 단위로 돈다. */
  private groupTagsByFile<T extends { fileId: string }>(tags: T[]) {
    const byFile = new Map<string, T[]>();
    for (const tag of tags) {
      const list = byFile.get(tag.fileId) ?? [];
      list.push(tag);
      byFile.set(tag.fileId, list);
    }
    return byFile;
  }

  /**
   * 태그된 아이의 오늘 출석 기록을 보장한다 — "출석은 공짜로 딸려온다"는 지점.
   *
   * 다만 **정기권 차감은 하지 않는다.** 사진을 올렸다는 이유로 돈이 움직이면 안 되고,
   * 등원 시각·차감은 출석부 화면에서 선생님이 명시적으로 하는 조작이다. 그래서 기존 기록이
   * 없을 때만 SCHEDULED 로 만들어 "오늘 출석부에 이 아이가 뜨게" 하는 데서 멈춘다.
   */
  private async ensureAttendance(petIds: string[], date: Date) {
    await ensureScheduledAttendance(petIds, date);
  }

  // ── 작성 ──────────────────────────────────────────────────────────────

  /** 태그가 가리키는 사진이 이 게시물에 실제로 들어 있는지 확인한다. */
  private assertTagsPointAtOwnMedia(
    tags: { fileId: string }[],
    mediaFileIds: string[],
  ) {
    const known = new Set(mediaFileIds);
    const stray = tags.find((tag) => !known.has(tag.fileId));
    if (stray) {
      throw new BadRequestException(
        "이 게시물에 없는 사진에 태그할 수 없습니다.",
      );
    }
  }

  /** 게시물 작성 (사진 여러 장 + 사진별 아이 태그). status=PUBLISHED 로 보내면 즉시 팬아웃된다. */
  async create(userId: string, dto: CreateFeedPostDto) {
    const date = startOfDay(dto.date);
    const tags = dto.tags ?? [];
    const mediaFileIds = dto.media.map((item) => item.fileId);
    this.assertTagsPointAtOwnMedia(tags, mediaFileIds);

    const petIds = [...new Set(tags.map((tag) => tag.petId))];
    const pets = await this.loadTaggedPets(petIds);
    const petById = new Map(pets.map((pet) => [pet.id, pet]));

    const publishNow = dto.status === FEED_POST_STATUS.PUBLISHED;
    if (publishNow) {
      // 동의 검사는 사진 단위다 — "초코만 있는 사진 + 몽이만 있는 사진"을 한 번에 올리는 건 정상이다.
      const byFile = this.groupTagsByFile(tags);
      this.assertConsentAllowsPublish(
        new Map(
          [...byFile].map(([fileId, list]) => [
            fileId,
            list.map((tag) => petById.get(tag.petId)!).filter(Boolean),
          ]),
        ),
      );
    }

    const aiCaptionDraft = this.captionDraftService.generateCaption({
      petNames: pets.map((pet) => pet.name),
      mediaCount: dto.media.length,
    });

    const tenantId = requireTenantId();
    const feedPost = await tenantTransaction(prisma, async (tx) => {
      await this.moveMediaTemps(
        mediaFileIds,
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        tx,
      );

      // 태그가 사진(FeedMedia.id)을 가리키므로 사진을 먼저 만들어 id 를 얻어야 한다.
      // 그래서 nested create 한 방이 아니라 두 단계로 나뉜다.
      const created = await tx.feedPost.create({
        data: {
          tenantId,
          authorId: userId,
          date,
          caption: dto.caption,
          aiCaptionDraft,
          status: dto.status ?? FEED_POST_STATUS.DRAFT,
          publishedAt: publishNow ? new Date() : null,
          // nested write 는 Prisma Extension 자동 주입 대상이 아니므로 tenantId 를 직접 채운다.
          media: {
            create: dto.media.map((item, index) => ({
              tenantId,
              fileId: item.fileId,
              type: item.type ?? "IMAGE",
              order: item.order ?? index,
            })),
          },
        },
        include: { media: { select: { id: true, fileId: true } } },
      });

      const mediaIdByFileId = new Map(
        created.media.map((item) => [item.fileId, item.id]),
      );
      if (tags.length > 0) {
        await tx.feedTag.createMany({
          data: tags.map((tag) => ({
            tenantId,
            postId: created.id,
            mediaId: mediaIdByFileId.get(tag.fileId)!,
            petId: tag.petId,
            source: tag.source ?? FEED_TAG_SOURCE.MANUAL,
            confidence: tag.confidence,
            confirmed: tag.confirmed ?? false,
          })),
          skipDuplicates: true,
        });
      }

      return tx.feedPost.findUniqueOrThrow({
        where: { id: created.id },
        include: POST_INCLUDE,
      });
    });

    // AI 가 제안했지만 사람이 뺀 아이(거짓 양성)까지 잡으려면 제안 명단 전체가 있어야 한다.
    // tags 만 보면 "거절당한 제안"이 통째로 사라져 정확도를 재는 쪽 절반이 비어버린다.
    await this.recordCorrections(
      feedPost.id,
      userId,
      (dto.suggestedPetIds ?? []).map((petId) => ({
        petId,
        source: FEED_TAG_SOURCE.AI,
        confidence: tags.find((tag) => tag.petId === petId)?.confidence ?? null,
      })),
      tags,
    );
    await this.ensureAttendance(petIds, date);

    if (publishNow) {
      await this.feedNotificationService.fanOut(
        pets.map((pet) => ({
          petId: pet.id,
          petName: pet.name,
          userId: pet.userId,
          guardianPhone: resolveGuardianPhone(pet),
        })),
        date,
      );
    }

    return { feedPost };
  }

  // ── 조회 ──────────────────────────────────────────────────────────────

  /** 매장 피드 목록 (date/petId 필터 + 페이지네이션·정렬) */
  async findAll(query: PaginationQuery & { date?: string; petId?: string }) {
    const { page, pageSize, skip, take, order, sort } =
      resolvePagination(query);

    const where: Prisma.FeedPostWhereInput = {
      ...(query.date ? { date: startOfDay(query.date) } : {}),
      ...(query.petId ? { tags: { some: { petId: query.petId } } } : {}),
    };

    const sortField = FEED_SORTABLE_FIELDS.includes(
      sort as (typeof FEED_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "createdAt";

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.feedPost.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: POST_INCLUDE,
      });
      const total = await tx.feedPost.count({ where });
      return [items, total] as const;
    });

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 게시물 상세 */
  async findOne(id: string) {
    const feedPost = await prisma.feedPost.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });
    if (!feedPost) {
      throw new NotFoundException("존재하지 않는 게시물입니다.");
    }
    return { feedPost };
  }

  /**
   * 보호자 피드 — 내 아이가 태그된 발행 게시물만.
   *
   * 기본 화면을 전체 원 피드로 두지 않는 것이 의도다. 보호자는 장수를 센다("우리 애 3장,
   * 옆집 애 12장"). 대신 단체 사진 한 장이 세 보호자 모두에게 "우리 아이 사진"으로 잡히므로
   * 등장 사진 수는 오히려 늘어난다.
   *
   * 한 회원이 여러 매장에 아이를 맡길 수 있어 테넌트를 가로질러 조회한다. 스코프는 테넌트가
   * 아니라 `pet.userId = 나` 이며, 그래서 runWithoutTenant 로 자동 주입을 명시적으로 끈다.
   */
  async findAllForOwner(
    userId: string,
    query: PaginationQuery & { petId?: string; date?: string },
  ) {
    const { page, pageSize, skip, take, order } = resolvePagination(query);

    const myPetFilter: Prisma.FeedTagWhereInput = {
      pet: { userId, ...(query.petId ? { id: query.petId } : {}) },
    };

    const where: Prisma.FeedPostWhereInput = {
      status: FEED_POST_STATUS.PUBLISHED,
      tags: { some: myPetFilter },
      ...(query.date ? { date: startOfDay(query.date) } : {}),
    };

    const [items, total] = await runWithoutTenant(async () => {
      const items = await prisma.feedPost.findMany({
        where,
        skip,
        take,
        orderBy: { publishedAt: order },
        // "내 아이가 누구인지" 판정에 소유자 id 가 필요하다. 응답에는 싣지 않고 아래에서 걷어낸다.
        include: OWNER_POST_INCLUDE,
      });
      const total = await prisma.feedPost.count({ where });
      return [items, total] as const;
    });

    type OwnerTag = {
      pet: { userId: string | null } & Record<string, unknown>;
    };
    // job-040: 계정이 연결되지 않은 아이(userId = null)는 어떤 보호자의 것도 아니다.
    // null === userId 는 성립할 수 없으므로 이 비교만으로 안전하지만, "빈 값끼리 우연히
    // 맞아떨어지는" 실수를 막기 위해 null 을 명시적으로 배제한다.
    const isMine = (tag: OwnerTag) =>
      tag.pet.userId !== null && tag.pet.userId === userId;

    // 내 아이가 아닌 PRIVATE 아이의 태그는 보호자에게 노출하지 않는다.
    // 발행 시점에 이미 막고 있으므로 정상 경로에선 걸릴 일이 없지만, 동의 범위는 나중에
    // 낮아질 수 있다(보호자가 PUBLIC -> PRIVATE 로 내리는 경우). 그때 이미 발행된 과거
    // 게시물이 조용히 새 설정을 위반하지 않도록 조회 시점에도 한 번 더 거른다.
    const visible = (tag: OwnerTag) =>
      isMine(tag) || tag.pet.photoConsent !== PHOTO_CONSENT.PRIVATE;

    const stripOwner = <T extends OwnerTag>({ pet, ...tag }: T) => ({
      ...tag,
      pet: {
        id: pet.id,
        name: pet.name,
        profileImageFileId: pet.profileImageFileId,
        photoConsent: pet.photoConsent,
      },
    });

    const posts = items
      .map((post) => {
        // **내 아이가 찍힌 사진만** 보여준다. 태그가 사진 단위이므로 여기서 정확히 갈린다 —
        // 게시물 단위였다면 우리 아이가 없는 사진까지 우리 아이 피드에 실렸다.
        const myMedia = post.media
          .filter((item) => item.tags.some(isMine))
          .map((item) => ({
            ...item,
            tags: item.tags.filter(visible).map(stripOwner),
          }));

        const myPetsById = new Map(
          post.media
            .flatMap((item) => item.tags)
            .filter(isMine)
            .map((tag) => [
              tag.pet.id,
              {
                id: tag.pet.id,
                name: tag.pet.name,
                profileImageFileId: tag.pet.profileImageFileId,
              },
            ]),
        );

        return {
          ...post,
          media: myMedia,
          // 상단 요약 칩도 보이는 사진 기준으로 다시 계산한다.
          tags: myMedia.flatMap((item) => item.tags),
          // 같은 사진이 세 보호자에게 각자 "우리 아이 사진"이 되는 지점.
          myPets: [...myPetsById.values()],
        };
      })
      // 필터 결과 남는 사진이 없으면 보여줄 게 없는 게시물이다.
      .filter((post) => post.media.length > 0);

    return buildPaginatedData(posts, { page, pageSize, total });
  }

  // ── 수정 ──────────────────────────────────────────────────────────────

  /**
   * AI 제안과 사람의 최종 판단이 어긋난 지점을 남긴다.
   *
   * "오인식 수정이 곧 학습 데이터"라는 것이 이 제품의 자산 논리다. 지금은 정확도 측정에만
   * 쓰지만, 얼굴 인식 모델을 붙이는 시점에 그대로 학습·평가 입력이 되므로 버리지 않는다.
   */
  private async recordCorrections(
    postId: string,
    userId: string,
    before: { petId: string; source: string; confidence: number | null }[],
    afterTags: CreateFeedTagDto[],
  ) {
    // 태그는 사진 단위라 한 아이가 여러 사진에 걸쳐 나온다. 판정("AI가 이 아이를 맞혔나")은
    // 게시물당 한 번이면 되므로 아이 기준으로 접는다. 한 장이라도 사람이 확인했으면 확인으로 본다.
    const after = [
      ...afterTags
        .reduce((acc, tag) => {
          const previous = acc.get(tag.petId);
          acc.set(tag.petId, {
            ...tag,
            confirmed:
              (previous?.confirmed ?? false) || (tag.confirmed ?? false),
          });
          return acc;
        }, new Map<string, CreateFeedTagDto>())
        .values(),
    ];

    const afterIds = new Set(after.map((tag) => tag.petId));
    const beforeById = new Map(before.map((tag) => [tag.petId, tag]));

    const rows: {
      tenantId: string;
      postId: string;
      petId: string;
      action: string;
      confidence: number | null;
      correctedBy: string;
    }[] = [];
    const tenantId = requireTenantId();

    // AI 가 제안했는데 사람이 뺐다 → 거짓 양성
    for (const tag of before) {
      if (tag.source !== FEED_TAG_SOURCE.AI) continue;
      if (afterIds.has(tag.petId)) continue;
      rows.push({
        tenantId,
        postId,
        petId: tag.petId,
        action: FEED_TAG_CORRECTION_ACTION.REMOVED,
        confidence: tag.confidence,
        correctedBy: userId,
      });
    }

    for (const tag of after) {
      const previous = beforeById.get(tag.petId);
      const isAiSuggested =
        (previous?.source ?? tag.source) === FEED_TAG_SOURCE.AI;

      if (isAiSuggested) {
        // AI 제안을 사람이 그대로 인정 → 참 양성. 확인 전이면 아직 판정이 아니다.
        if (!tag.confirmed) continue;
        rows.push({
          tenantId,
          postId,
          petId: tag.petId,
          action: FEED_TAG_CORRECTION_ACTION.CONFIRMED,
          confidence: previous?.confidence ?? tag.confidence ?? null,
          correctedBy: userId,
        });
        continue;
      }

      // AI 가 놓친 아이를 사람이 직접 추가 → 거짓 음성. 이미 있던 수동 태그는 재기록하지 않는다.
      if (previous) continue;
      rows.push({
        tenantId,
        postId,
        petId: tag.petId,
        action: FEED_TAG_CORRECTION_ACTION.ADDED,
        confidence: null,
        correctedBy: userId,
      });
    }

    if (rows.length === 0) return;
    await prisma.feedTagCorrection.createMany({ data: rows });
  }

  /** 게시물 수정 (캡션/태그). tags 전달 시 태그 전체를 대체하고 수정 내역을 학습 데이터로 남긴다. */
  async update(id: string, userId: string, dto: UpdateFeedPostDto) {
    const { feedPost: existing } = await this.findOne(id);

    const nextTags = dto.tags;
    const mediaFileIds = existing.media.map((item) => item.fileId);
    if (nextTags) {
      this.assertTagsPointAtOwnMedia(nextTags, mediaFileIds);
    }

    const petIds = nextTags
      ? [...new Set(nextTags.map((tag) => tag.petId))]
      : [...new Set(existing.tags.map((tag) => tag.petId))];
    const pets = await this.loadTaggedPets(petIds);
    const petById = new Map(pets.map((pet) => [pet.id, pet]));

    const becomesPublished =
      dto.status === FEED_POST_STATUS.PUBLISHED &&
      existing.status !== FEED_POST_STATUS.PUBLISHED;

    if (dto.status === FEED_POST_STATUS.PUBLISHED) {
      // 태그를 새로 받았으면 그것으로, 아니면 이미 저장된 사진별 태그로 검사한다.
      const petsByFile = nextTags
        ? new Map(
            [...this.groupTagsByFile(nextTags)].map(([fileId, list]) => [
              fileId,
              list.map((tag) => petById.get(tag.petId)!).filter(Boolean),
            ]),
          )
        : new Map(
            existing.media.map((item) => [
              item.fileId,
              item.tags.map((tag) => tag.pet),
            ]),
          );
      this.assertConsentAllowsPublish(petsByFile);
    }

    const date = dto.date ? startOfDay(dto.date) : existing.date;
    const tenantId = requireTenantId();
    const mediaIdByFileId = new Map(
      existing.media.map((item) => [item.fileId, item.id]),
    );

    const feedPost = await tenantTransaction(prisma, async (tx) => {
      await tx.feedPost.update({
        where: { id },
        data: {
          date: dto.date ? date : undefined,
          caption: dto.caption,
          status: dto.status,
          publishedAt: becomesPublished ? new Date() : undefined,
        },
      });

      if (nextTags) {
        // 태그는 최종 명단으로 통째 대체한다. 부분 수정보다 단순하고, AI 제안과의 차이를
        // 그대로 뽑아낼 수 있어 학습 데이터를 만들기도 쉽다.
        await tx.feedTag.deleteMany({ where: { postId: id } });
        if (nextTags.length > 0) {
          await tx.feedTag.createMany({
            data: nextTags.map((tag) => ({
              tenantId,
              postId: id,
              mediaId: mediaIdByFileId.get(tag.fileId)!,
              petId: tag.petId,
              source: tag.source ?? FEED_TAG_SOURCE.MANUAL,
              confidence: tag.confidence,
              confirmed: tag.confirmed ?? false,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.feedPost.findUniqueOrThrow({
        where: { id },
        include: POST_INCLUDE,
      });
    });

    if (nextTags) {
      await this.recordCorrections(
        id,
        userId,
        existing.tags.map((tag) => ({
          petId: tag.petId,
          source: tag.source,
          confidence: tag.confidence,
        })),
        nextTags,
      );
      await this.ensureAttendance(petIds, date);
    }

    // 이번 수정으로 처음 발행된 경우에만 알림을 보낸다 (재수정 시 재발송 방지).
    if (becomesPublished) {
      await this.feedNotificationService.fanOut(
        pets.map((pet) => ({
          petId: pet.id,
          petName: pet.name,
          userId: pet.userId,
          guardianPhone: resolveGuardianPhone(pet),
        })),
        date,
      );
    }

    return { feedPost };
  }

  /** 발행 — 태그된 아이의 보호자 피드에 뿌리고 알림톡을 보낸다 */
  async publish(id: string, userId: string) {
    return this.update(id, userId, { status: FEED_POST_STATUS.PUBLISHED });
  }

  /** 게시물 삭제 (사진·태그는 FK CASCADE 로 함께 지워진다) */
  async remove(id: string) {
    await this.findOne(id);
    await prisma.feedPost.delete({ where: { id } });
    return { id };
  }
}
