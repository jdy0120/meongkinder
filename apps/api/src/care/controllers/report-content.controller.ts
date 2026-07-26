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
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ROLES } from "@pawlog/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import { CreateReportContentDto, UpdateReportContentDto } from "../dtos";
import { REPORT_CONTENT_ROUTES } from "../routes";
import { ReportContentService } from "../services/report-content.service";

// 리포트 항목 작성/관리는 돌봄 스태프/관리자 전용 업무이므로 ADMIN 만 접근 가능.
@ApiTags("ReportContent")
@ApiBearerAuth()
@Roles(ROLES.ADMIN)
@Controller(REPORT_CONTENT_ROUTES.v1.BASE)
export class ReportContentController {
  constructor(private readonly reportContentService: ReportContentService) {}

  @Post(REPORT_CONTENT_ROUTES.v1.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("리포트 항목이 추가되었습니다.")
  async create(
    @Param("dailyReportId") dailyReportId: string,
    @Body() dto: CreateReportContentDto,
  ) {
    return this.reportContentService.create(dailyReportId, dto);
  }

  @Get(REPORT_CONTENT_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Param("dailyReportId") dailyReportId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reportContentService.findAll(dailyReportId, query);
  }

  @Get(REPORT_CONTENT_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param("dailyReportId") dailyReportId: string,
    @Param("id") id: string,
  ) {
    return this.reportContentService.findOne(dailyReportId, id);
  }

  @Patch(REPORT_CONTENT_ROUTES.v1.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("리포트 항목이 수정되었습니다.")
  async update(
    @Param("dailyReportId") dailyReportId: string,
    @Param("id") id: string,
    @Body() dto: UpdateReportContentDto,
  ) {
    return this.reportContentService.update(dailyReportId, id, dto);
  }

  @Delete(REPORT_CONTENT_ROUTES.v1.DELETE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("리포트 항목이 삭제되었습니다.")
  async remove(
    @Param("dailyReportId") dailyReportId: string,
    @Param("id") id: string,
  ) {
    return this.reportContentService.remove(dailyReportId, id);
  }
}
