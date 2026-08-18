import { Controller, Get, HttpCode, HttpStatus, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ROLES } from "@pawlog/shared";
import { Roles } from "../../shared/decorators/roles.decorator";
import { MonthlyRevenueQueryDto, RevenueSummaryQueryDto } from "../dtos";
import { REVENUE_ROUTES } from "../routes";
import { RevenueService } from "../services/revenue.service";

/**
 * 유치원 매출 (job-051) — 매장 화면 `/tenant/[tenant]/revenue` 전용.
 *
 * `@Roles(TENANT_ADMIN)` 이고 STAFF 는 제외한다. 출석·알림장은 데스크 업무라 STAFF 에게
 * 열려 있지만(job-046), 매출은 경영 정보다 — 아르바이트 선생님이 원장의 월 매출을 볼
 * 이유가 없다. 같은 이유로 이용권 판매 현황(`v1/subscriptions`)도 TENANT_ADMIN 전용이다.
 */
@ApiTags("Revenue")
@ApiBearerAuth()
@Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
@Controller(REVENUE_ROUTES.v1.BASE)
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Get(REVENUE_ROUTES.v1.MONTHLY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "최근 N개월 매출 추이 (입금 기준)" })
  async monthly(@Query() query: MonthlyRevenueQueryDto) {
    return this.revenueService.monthly(query.months);
  }

  @Get(REVENUE_ROUTES.v1.DAILY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "특정 월의 날짜별 매출 (달력용)" })
  async daily(@Query() query: RevenueSummaryQueryDto) {
    return this.revenueService.daily(query.year, query.month);
  }

  @Get(REVENUE_ROUTES.v1.SUMMARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "특정 월 매출 상세 (결제수단별·요금제별·건별)" })
  async summary(@Query() query: RevenueSummaryQueryDto) {
    return this.revenueService.summary(query.year, query.month);
  }
}
