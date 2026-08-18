import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { ROLES } from "@pawlog/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import {
  CreateFeedPostDto,
  FeedCaptionDraftDto,
  FeedCoverageQueryDto,
  FeedPostQueryDto,
  RunFeedDigestDto,
  SuggestFeedTagsDto,
  UpdateFeedPostDto,
} from "../dtos";
import { FEED_ROUTES } from "../routes";
import { FeedCaptionDraftService } from "../services/feed-caption-draft.service";
import { FeedCoverageService } from "../services/feed-coverage.service";
import { FeedDigestService } from "../services/feed-digest.service";
import { FeedPostService } from "../services/feed-post.service";
import { FeedTagSuggestionService } from "../services/feed-tag-suggestion.service";
import { prisma } from "@pawlog/database";

/**
 * 피드 — 사진 한 장이 여러 보호자에게 팬아웃되는 기록 방식 (job-034).
 *
 * 업로드·마감은 현장 업무이므로 STAFF/TENANT_ADMIN/SUPER_ADMIN 전용이다. 보호자(USER)가 자기
 * 아이의 피드를 보는 `mine` 만 메서드 레벨 `@Roles()` 로 클래스 제약을 덮는다
 * (RolesGuard 가 getAllAndOverride 를 쓰므로 빈 @Roles() 는 "역할 제한 없음"이 된다).
 */
@ApiTags("Feed")
@ApiBearerAuth()
@Roles(ROLES.STAFF, ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
@Controller(FEED_ROUTES.v1.BASE)
export class FeedController {
  constructor(
    private readonly feedPostService: FeedPostService,
    private readonly tagSuggestionService: FeedTagSuggestionService,
    private readonly captionDraftService: FeedCaptionDraftService,
    private readonly coverageService: FeedCoverageService,
    private readonly digestService: FeedDigestService,
  ) {}

  // ── 업로드 플로우 ───────────────────────────────────────────────────────

  @Post(FEED_ROUTES.v1.SUGGEST_TAGS)
  @HttpCode(HttpStatus.OK)
  async suggestTags(@Body() dto: SuggestFeedTagsDto) {
    return this.tagSuggestionService.suggest(dto);
  }

  @Post(FEED_ROUTES.v1.CAPTION_DRAFT)
  @HttpCode(HttpStatus.OK)
  async captionDraft(@Body() dto: FeedCaptionDraftDto) {
    const pets = await prisma.pet.findMany({
      where: { id: { in: dto.petIds } },
      select: { name: true },
    });
    const caption = this.captionDraftService.generateCaption({
      petNames: pets.map((pet) => pet.name),
      mediaCount: 0,
    });
    return { caption };
  }

  // ── 보호자 ─────────────────────────────────────────────────────────────
  // ":id" 계열보다 먼저 선언되어야 한다.

  @Roles()
  @Get(FEED_ROUTES.v1.MY_LIST)
  @HttpCode(HttpStatus.OK)
  async findMine(@Req() req: Request, @Query() query: FeedPostQueryDto) {
    const userId = req.user?.userId || "";
    return this.feedPostService.findAllForOwner(userId, query);
  }

  // ── 원장/선생님 ────────────────────────────────────────────────────────

  @Get(FEED_ROUTES.v1.COVERAGE)
  @HttpCode(HttpStatus.OK)
  async findCoverage(@Query() query: FeedCoverageQueryDto) {
    return this.coverageService.findCoverage(query.date);
  }

  @Post(FEED_ROUTES.v1.DIGEST)
  @HttpCode(HttpStatus.OK)
  // 성공 메시지는 서비스가 결과에 따라 정한다(0건이면 "만들어진 알림장이 없습니다").
  async runDigest(@Body() dto: RunFeedDigestDto) {
    return this.digestService.run(dto);
  }

  @Get(FEED_ROUTES.v1.POST_LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: FeedPostQueryDto) {
    return this.feedPostService.findAll(query);
  }

  @Post(FEED_ROUTES.v1.POST_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("게시물이 저장되었습니다.")
  async create(@Req() req: Request, @Body() dto: CreateFeedPostDto) {
    const userId = req.user?.userId || "";
    return this.feedPostService.create(userId, dto);
  }

  @Get(FEED_ROUTES.v1.POST_GET)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    return this.feedPostService.findOne(id);
  }

  @Patch(FEED_ROUTES.v1.POST_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("게시물이 수정되었습니다.")
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateFeedPostDto,
  ) {
    const userId = req.user?.userId || "";
    return this.feedPostService.update(id, userId, dto);
  }

  @Post(FEED_ROUTES.v1.POST_PUBLISH)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("게시물이 발행되어 보호자에게 전달되었습니다.")
  async publish(@Req() req: Request, @Param("id") id: string) {
    const userId = req.user?.userId || "";
    return this.feedPostService.publish(id, userId);
  }

  @Delete(FEED_ROUTES.v1.POST_DELETE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("게시물이 삭제되었습니다.")
  async remove(@Param("id") id: string) {
    return this.feedPostService.remove(id);
  }
}
