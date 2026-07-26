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
import { CreateDailyReportDto, UpdateDailyReportDto } from "../dtos";
import { DAILY_REPORT_ROUTES } from "../routes";
import { DailyReportService } from "../services/daily-report.service";

// 일일 리포트 작성/관리는 돌봄 스태프/관리자 전용 업무이므로 ADMIN 만 접근 가능.
@ApiTags("DailyReport")
@ApiBearerAuth()
@Roles(ROLES.ADMIN)
@Controller(DAILY_REPORT_ROUTES.v1.BASE)
export class DailyReportController {
  constructor(private readonly dailyReportService: DailyReportService) {}

  @Post(DAILY_REPORT_ROUTES.v1.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("일일 리포트가 작성되었습니다.")
  async create(@Body() dto: CreateDailyReportDto) {
    return this.dailyReportService.create(dto);
  }

  @Get(DAILY_REPORT_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query("petId") petId?: string,
  ) {
    return this.dailyReportService.findAll({ ...query, petId });
  }

  @Get(DAILY_REPORT_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    return this.dailyReportService.findOne(id);
  }

  @Patch(DAILY_REPORT_ROUTES.v1.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("일일 리포트가 수정되었습니다.")
  async update(@Param("id") id: string, @Body() dto: UpdateDailyReportDto) {
    return this.dailyReportService.update(id, dto);
  }

  @Delete(DAILY_REPORT_ROUTES.v1.DELETE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("일일 리포트가 삭제되었습니다.")
  async remove(@Param("id") id: string) {
    return this.dailyReportService.remove(id);
  }
}
