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
import { Public } from "../../shared/decorators/public.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import {
  CreateDailyReportDto,
  DailyReportQueryDto,
  SharedReportQueryDto,
  UpdateDailyReportDto,
} from "../dtos";
import { DAILY_REPORT_ROUTES } from "../routes";
import { DailyReportService } from "../services/daily-report.service";
import { ReportShareService } from "../services/report-share.service";

// 일일 리포트 작성/관리는 돌봄 스태프/관리자 전용 업무이므로 STAFF/TENANT_ADMIN/SUPER_ADMIN 만 접근 가능.
// 단, 보호자(USER)가 발행된 본인 반려동물의 리포트를 열람하는 mine/mine:id 엔드포인트는
// 메서드 레벨 @Roles() 로 클래스 레벨 제약을 오버라이드한다 (RolesGuard 는 getAllAndOverride 사용).
@ApiTags("DailyReport")
@ApiBearerAuth()
@Roles(ROLES.STAFF, ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
@Controller(DAILY_REPORT_ROUTES.v1.BASE)
export class DailyReportController {
  constructor(
    private readonly dailyReportService: DailyReportService,
    private readonly reportShareService: ReportShareService,
  ) {}

  @Post(DAILY_REPORT_ROUTES.v1.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("일일 리포트가 작성되었습니다.")
  async create(@Req() req: Request, @Body() dto: CreateDailyReportDto) {
    return this.dailyReportService.create(dto, req.user?.userId);
  }

  /**
   * 매장 리포트 목록. `date` 를 받는다 — 화면의 기본값이 **오늘 하루**이고 캘린더에서
   * 다른 날을 고르면 그 날짜로 다시 조회한다.
   *
   * `@Query("petId")` 를 따로 받던 것을 `DailyReportQueryDto` 로 합쳤다. 전역
   * ValidationPipe 가 whitelist 를 강제하므로 PaginationQueryDto 를 상속한 DTO 로
   * 선언해야 필터가 400 으로 튕기지 않는다(그 DTO 는 보호자 목록용으로 이미 있었다).
   */
  @Get(DAILY_REPORT_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: DailyReportQueryDto) {
    return this.dailyReportService.findAll(query);
  }

  // 보호자 - 본인 소유 반려동물의 발행된 리포트 목록. ":id" 라우트보다 먼저 매칭되어야 함.
  @Roles()
  @Get(DAILY_REPORT_ROUTES.v1.MY_LIST)
  @HttpCode(HttpStatus.OK)
  async findMine(@Req() req: Request, @Query() query: DailyReportQueryDto) {
    const userId = req.user?.userId || "";
    return this.dailyReportService.findAllForOwner(userId, query);
  }

  // 보호자 - 리포트 상세 (본인 소유 확인)
  @Roles()
  @Get(DAILY_REPORT_ROUTES.v1.MY_DETAIL)
  @HttpCode(HttpStatus.OK)
  async findOneMine(@Req() req: Request, @Param("id") id: string) {
    const userId = req.user?.userId || "";
    return this.dailyReportService.findOneForOwner(userId, id);
  }

  /**
   * 공개 알림장 (job-040) — 로그인 없이 서명 토큰으로 1건만 연다.
   *
   * 알림톡은 계정이 아니라 전화번호로 나가므로 아직 가입하지 않은 보호자도 받는다. 그
   * 알림톡의 링크가 로그인을 요구하면 결국 가입해야 볼 수 있고, "설치도 가입도 요구하지
   * 않는다"는 전제가 마지막 한 칸에서 무너진다.
   *
   * 토큰이 곧 열쇠이므로 응답에는 그 리포트에 필요한 것만 담는다(보호자 연락처·다른 아이·
   * 계정 정보 없음). 검증과 범위 제한은 ReportShareService 가 한다.
   */
  @Public()
  @Get(DAILY_REPORT_ROUTES.v1.SHARED)
  @HttpCode(HttpStatus.OK)
  async findShared(@Query() query: SharedReportQueryDto) {
    return this.reportShareService.findByToken(query.token);
  }

  @Get(DAILY_REPORT_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    return this.dailyReportService.findOne(id);
  }

  @Patch(DAILY_REPORT_ROUTES.v1.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("일일 리포트가 수정되었습니다.")
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateDailyReportDto,
  ) {
    return this.dailyReportService.update(id, dto, req.user?.userId);
  }

  @Delete(DAILY_REPORT_ROUTES.v1.DELETE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("일일 리포트가 삭제되었습니다.")
  async remove(@Param("id") id: string) {
    return this.dailyReportService.remove(id);
  }
}
