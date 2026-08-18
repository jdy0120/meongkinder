import { Injectable, NotFoundException } from "@nestjs/common";
import {
  prisma,
  Prisma,
  requireTenantId,
  tenantTransaction,
  type DailyReport,
  type ExtendedTransactionClient,
} from "@pawlog/database";
import {
  buildPaginatedData,
  resolvePagination,
  type PaginationQuery,
} from "@pawlog/shared";
import { NotificationService } from "../../notification/services/notification.service";
import { FileService } from "../../shared/file/services/file.service";
import { FeedMirrorService } from "../../feed/services/feed-mirror.service";
import { resolveGuardianPhone } from "../../shared/utils";
import { CreateDailyReportDto, UpdateDailyReportDto } from "../dtos";
import { AiCommentDraftService } from "./ai-comment-draft.service";
import { ReportShareService } from "./report-share.service";

/** 알림톡에 담을 링크의 기준 주소 (apps/web). */
const webUrl = () => process.env.WEB_URL ?? "http://localhost:3001";

const DAILY_REPORT_SORTABLE_FIELDS = ["createdAt", "date"] as const;

interface DraftContentInput {
  type: string;
  title?: string | null;
  content?: string | null;
  fileId?: string | null;
  order?: number;
}

@Injectable()
export class DailyReportService {
  constructor(
    private readonly aiCommentDraftService: AiCommentDraftService,
    private readonly fileService: FileService,
    private readonly notificationService: NotificationService,
    private readonly reportShareService: ReportShareService,
    private readonly feedMirrorService: FeedMirrorService,
  ) {}

  /**
   * 리포트가 이번 저장으로 PUBLISHED 상태가 되었고 연동된 출석(하원) 기록이 있다면
   * 보호자에게 "하원 + 일일 리포트 링크" 알림을 발송한다.
   */
  private async notifyIfPublished(dailyReport: DailyReport) {
    if (dailyReport.status !== "PUBLISHED" || !dailyReport.attendanceId) {
      return;
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id: dailyReport.attendanceId },
      include: {
        pet: {
          select: {
            name: true,
            guardianPhone: true,
            userId: true,
            user: { select: { phone: true } },
          },
        },
      },
    });
    if (!attendance?.checkOutAt) return;

    const reportToken = this.reportShareService.createToken(
      dailyReport.id,
      dailyReport.petId,
    );

    await this.notificationService.notifyCheckOutWithReport({
      userId: attendance.pet.userId,
      petId: dailyReport.petId,
      petName: attendance.pet.name,
      guardianPhone: resolveGuardianPhone(attendance.pet),
      attendanceId: attendance.id,
      dailyReportId: dailyReport.id,
      checkOutAt: attendance.checkOutAt,
      // 로그인 없이 열리는 공개 링크. 아직 가입하지 않은 보호자도 받는 알림이므로
      // 로그인 뒤에 있는 주소를 보내면 그 사람은 알림장을 영영 볼 수 없다.
      reportUrl: `${webUrl()}/r/${reportToken}`,
      // 알림톡은 **전체 URL 을 변수로 못 받는다** — 도메인은 버튼에 고정으로 등록하고
      // 가변 부분(토큰)만 치환된다. 그래서 토큰을 따로 넘긴다.
      // SMS 폴백은 버튼이 없으므로 위 전체 URL 을 그대로 쓴다.
      reportToken,
    });
  }

  /** 리포트 항목에 포함된 사진 등 첨부 파일을 임시 업로드(v1/file) → 영구 저장소로 이동 (v1/file 모듈 재사용) */
  private async movePhotoTemps(
    contents: DraftContentInput[],
    petId: string,
    tx: ExtendedTransactionClient,
  ) {
    const fileIds = contents
      .map((content) => content.fileId)
      .filter((fileId): fileId is string => Boolean(fileId));

    if (fileIds.length === 0) return;

    await this.fileService.moveTempsToUploads({
      fileList: fileIds.map((id) => ({ id })),
      domain: "daily-report",
      newPath: petId,
      tx,
    });
  }

  /**
   * 일일 리포트 작성 (사진/식사/배변/낮잠/활동/특이사항 항목 일괄 입력 + AI 코멘트 초안 생성)
   *
   * ⚠️ `authorId` 를 반드시 채운다. 이 컬럼은 표기용이 아니라 **하루 마감이 사진을 덮어쓸지
   * 판단하는 유일한 근거**다 — `FeedDigestService.upsertReport` 가
   * `writtenByPerson = Boolean(existing.authorId)` 로 갈라서, 사람이 쓴 리포트에는 피드
   * 사진을 끼워 넣지 않는다. 비워 두면 그 분기가 영영 거짓이 되어, 재마감할 때마다
   * 선생님이 직접 올린 사진이 피드 사진으로 조용히 교체된다(글 항목은 남고 사진만 바뀌므로
   * 알아채기도 어렵다).
   */
  async create(dto: CreateDailyReportDto, authorId?: string) {
    const pet = await prisma.pet.findUnique({ where: { id: dto.petId } });
    if (!pet) {
      throw new NotFoundException("존재하지 않는 반려동물입니다.");
    }

    const contents = dto.contents ?? [];
    const aiCommentDraft = this.aiCommentDraftService.generateDraft(
      contents,
      dto.summary,
    );

    const tenantId = requireTenantId();
    const dailyReport = await tenantTransaction(prisma, async (tx) => {
      await this.movePhotoTemps(contents, dto.petId, tx);

      return tx.dailyReport.create({
        data: {
          tenantId,
          petId: dto.petId,
          authorId,
          attendanceId: dto.attendanceId,
          date: new Date(dto.date),
          summary: dto.summary,
          status: dto.status,
          aiCommentDraft,
          // nested write는 Prisma Extension 자동 주입 대상이 아니므로 tenantId 를 직접 채운다.
          contents: {
            create: contents.map((content, index) => ({
              tenantId,
              type: content.type,
              title: content.title,
              content: content.content,
              fileId: content.fileId,
              order: content.order ?? index,
            })),
          },
        },
        include: { contents: true },
      });
    });

    // job-062: 알림장 사진을 피드에도 쌓는다. 트랜잭션 밖인 이유는 미러가 파생 데이터라
    // 실패가 알림장 저장을 되돌리면 안 되기 때문이다(같은 알림장을 두 번 만들게 된다).
    await this.feedMirrorService.syncQuietly(dailyReport.id);

    await this.notifyIfPublished(dailyReport);
    return { dailyReport };
  }

  /** 일일 리포트 목록 (petId/date 필터 + 페이지네이션·정렬) */
  async findAll(query: PaginationQuery & { petId?: string; date?: string }) {
    const { page, pageSize, skip, take, order, sort } =
      resolvePagination(query);

    const where: Prisma.DailyReportWhereInput = {
      ...(query.petId ? { petId: query.petId } : {}),
      // `date` 는 `@db.Date` 라 하루 = 값 하나다. 범위 비교가 필요 없고, 넣으면
      // 오히려 경계(자정)에서 하루가 밀린다.
      ...(query.date ? { date: new Date(query.date) } : {}),
    };

    const sortField = DAILY_REPORT_SORTABLE_FIELDS.includes(
      sort as (typeof DAILY_REPORT_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "date";

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.dailyReport.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: { contents: true },
      });
      const total = await tx.dailyReport.count({ where });
      return [items, total] as const;
    });

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

  /** 보호자 - 본인 소유 반려동물의 발행(PUBLISHED)된 리포트 목록 (petId/date 필터 + 페이지네이션) */
  async findAllForOwner(
    userId: string,
    query: PaginationQuery & { petId?: string; date?: string },
  ) {
    const { page, pageSize, skip, take, order, sort } =
      resolvePagination(query);

    const where: Prisma.DailyReportWhereInput = {
      status: "PUBLISHED",
      pet: { userId },
      ...(query.petId ? { petId: query.petId } : {}),
      ...(query.date ? { date: new Date(query.date) } : {}),
    };

    const sortField = DAILY_REPORT_SORTABLE_FIELDS.includes(
      sort as (typeof DAILY_REPORT_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "date";

    const [items, total] = await tenantTransaction(prisma, async (tx) => {
      const items = await tx.dailyReport.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: {
          contents: true,
          pet: { select: { id: true, name: true, profileImageFileId: true } },
        },
      });
      const total = await tx.dailyReport.count({ where });
      return [items, total] as const;
    });

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /** 보호자 - 리포트 상세 조회 (본인 소유 확인, 발행된 리포트만 노출) */
  async findOneForOwner(userId: string, id: string) {
    const dailyReport = await prisma.dailyReport.findFirst({
      where: { id, status: "PUBLISHED", pet: { userId } },
      include: {
        contents: true,
        pet: { select: { id: true, name: true, profileImageFileId: true } },
      },
    });
    if (!dailyReport) {
      throw new NotFoundException("존재하지 않는 일일 리포트입니다.");
    }
    return { dailyReport };
  }

  /**
   * 일일 리포트 수정 (contents 전달 시 기존 항목을 대체하고 AI 코멘트 초안을 재생성)
   *
   * ## `authorId` 는 **항목을 손댔을 때만** 채운다
   *
   * `authorId` 가 뜻하는 것은 "누가 마지막으로 열었나"가 아니라 **"사람이 이 리포트의 사진을
   * 직접 골랐다"** 이다(하루 마감이 그걸로 사진 덮어쓰기를 가른다). 그래서 `contents` 가
   * 실린 수정에만 작성자를 남긴다.
   *
   * 상태만 바꾸는 수정(피드가 만든 초안을 검토 후 발행)에서 작성자를 찍으면, 그 순간부터
   * 하루 마감이 그 리포트의 사진을 갱신하지 못한다. "5시에 마감·발행하고 6시에 사진을 더
   * 올린 뒤 다시 마감"은 현장에서 당연히 일어나는 흐름이라(FeedDigestService 주석), 나중에
   * 올린 사진이 영영 알림장에 들어가지 않게 된다.
   */
  async update(id: string, dto: UpdateDailyReportDto, authorId?: string) {
    const existing = await this.findOne(id);

    const finalContents = dto.contents ?? existing.dailyReport.contents;
    const finalSummary =
      dto.summary ?? existing.dailyReport.summary ?? undefined;
    const aiCommentDraft = this.aiCommentDraftService.generateDraft(
      finalContents,
      finalSummary,
    );

    const dailyReport = await tenantTransaction(prisma, async (tx) => {
      if (dto.contents) {
        await this.movePhotoTemps(dto.contents, existing.dailyReport.petId, tx);
      }

      return tx.dailyReport.update({
        where: { id },
        data: {
          // 항목을 손댄 수정만 작성자를 남긴다 (위 주석 참고).
          authorId: dto.contents ? authorId : undefined,
          attendanceId: dto.attendanceId,
          date: dto.date ? new Date(dto.date) : undefined,
          summary: dto.summary,
          status: dto.status,
          aiCommentDraft,
          // nested write는 Prisma Extension 자동 주입 대상이 아니므로 tenantId 를 직접 채운다.
          contents: dto.contents
            ? {
                deleteMany: {},
                create: dto.contents.map((content, index) => ({
                  tenantId: requireTenantId(),
                  type: content.type,
                  title: content.title,
                  content: content.content,
                  fileId: content.fileId,
                  order: content.order ?? index,
                })),
              }
            : undefined,
        },
        include: { contents: true },
      });
    });

    // job-062: 항목·상태가 바뀌었을 수 있으므로 미러를 현재 상태로 다시 맞춘다.
    await this.feedMirrorService.syncQuietly(id);

    // 이번 수정으로 처음 PUBLISHED 상태가 된 경우에만 알림을 발송한다 (재수정 시 재발송 방지).
    if (
      existing.dailyReport.status !== "PUBLISHED" &&
      dailyReport.status === "PUBLISHED"
    ) {
      await this.notifyIfPublished(dailyReport);
    }
    return { dailyReport };
  }

  /** 일일 리포트 삭제 */
  async remove(id: string) {
    await this.findOne(id);
    await prisma.dailyReport.delete({ where: { id } });
    return { id };
  }
}
