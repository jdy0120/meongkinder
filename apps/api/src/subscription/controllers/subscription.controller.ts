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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { ROLES } from "@pawlog/shared";
import { Public } from "../../shared/decorators/public.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { Roles } from "../../shared/decorators/roles.decorator";
import { PaginationQueryDto } from "../../shared/dtos";
import {
  CreateSubscriptionDto,
  CreateSubscriptionPlanDto,
  IssueBillingKeyDto,
  UpdateSubscriptionPlanDto,
} from "../dtos";
import { SUBSCRIPTION_ROUTES } from "../routes";
import { SubscriptionService } from "../services/subscription.service";

@ApiTags("Subscription")
@Controller(SUBSCRIPTION_ROUTES.v1.BASE)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // 1. 요금제 목록 조회 (비로그인 공개, 판매 활성화된 요금제만)
  @Public()
  @Get(SUBSCRIPTION_ROUTES.v1.PLANS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "구독 요금제 목록 조회" })
  async listPlans() {
    return this.subscriptionService.listPlans();
  }

  // 1-1. 요금제 전체 목록 조회 (TENANT_ADMIN, 비활성 포함, 페이지네이션)
  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(SUBSCRIPTION_ROUTES.v1.PLANS_ALL)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "요금제 전체 목록 조회 (TENANT_ADMIN)" })
  async listAllPlans(@Query() query: PaginationQueryDto) {
    return this.subscriptionService.listAllPlans(query);
  }

  // 1-2. 요금제 등록 (TENANT_ADMIN)
  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Post(SUBSCRIPTION_ROUTES.v1.PLAN_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: "요금제 등록 (TENANT_ADMIN)" })
  @ResponseMessage("요금제가 등록되었습니다.")
  async createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionService.createPlan(dto);
  }

  // 1-3. 요금제 상세 조회 (TENANT_ADMIN)
  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(SUBSCRIPTION_ROUTES.v1.PLAN_DETAIL)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "요금제 상세 조회 (TENANT_ADMIN)" })
  async getPlan(@Param("id") id: string) {
    return this.subscriptionService.getPlan(id);
  }

  // 1-4. 요금제 수정 (TENANT_ADMIN)
  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Patch(SUBSCRIPTION_ROUTES.v1.PLAN_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "요금제 수정 (TENANT_ADMIN)" })
  @ResponseMessage("요금제가 수정되었습니다.")
  async updatePlan(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionService.updatePlan(id, dto);
  }

  // 1-5. 요금제 판매 중지 (TENANT_ADMIN, soft delete)
  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Delete(SUBSCRIPTION_ROUTES.v1.PLAN_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "요금제 판매 중지 (TENANT_ADMIN)" })
  @ResponseMessage("요금제 판매가 중지되었습니다.")
  async deletePlan(@Param("id") id: string) {
    return this.subscriptionService.deletePlan(id);
  }

  // 2. 빌링키 등록 (카드 등록)
  @Post(SUBSCRIPTION_ROUTES.v1.BILLING_KEY)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "정기 결제용 빌링키(카드) 등록" })
  @ResponseMessage("결제 수단이 등록되었습니다.")
  async registerBillingKey(
    @Req() req: Request,
    @Body() dto: IssueBillingKeyDto,
  ) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.registerBillingKey(userId, dto);
  }

  // 3. 구독 신청 (첫 결제 포함)
  @Post(SUBSCRIPTION_ROUTES.v1.SUBSCRIBE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: "구독 신청 및 첫 결제 수행" })
  @ResponseMessage("구독이 시작되었습니다.")
  async subscribe(@Req() req: Request, @Body() dto: CreateSubscriptionDto) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.subscribe(userId, dto);
  }

  // 4. 구독 해지 신청
  @Post(SUBSCRIPTION_ROUTES.v1.CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "이용 중인 구독 해지 신청" })
  @ResponseMessage(
    "구독이 해지 처리되었습니다. 이번 결제 주기 만료일 전까지는 혜택이 유지됩니다.",
  )
  async cancel(@Req() req: Request) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.cancel(userId);
  }

  // 4-1. 일시정지(휴회)
  @Post(SUBSCRIPTION_ROUTES.v1.PAUSE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "이용 중인 정기권 일시정지(휴회)" })
  @ResponseMessage("정기권이 일시정지(휴회) 처리되었습니다.")
  async pause(@Req() req: Request) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.pause(userId);
  }

  // 4-2. 일시정지(휴회) 해제 및 재개
  @Post(SUBSCRIPTION_ROUTES.v1.RESUME)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "일시정지(휴회) 해제 및 재개" })
  @ResponseMessage("정기권 이용이 재개되었습니다.")
  async resume(@Req() req: Request) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.resume(userId);
  }

  // 5. 내 구독 상태 확인
  @Get(SUBSCRIPTION_ROUTES.v1.MINE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "나의 현재 구독 정보 조회" })
  async getMySubscription(@Req() req: Request) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.getMySubscription(userId);
  }

  // 6. 나의 정기권/회수권(티켓) 목록 + 잔여 횟수
  @Get(SUBSCRIPTION_ROUTES.v1.MY_TICKETS)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "나의 정기권/회수권(티켓) 목록 및 잔여 횟수 조회" })
  async getMyTickets(@Req() req: Request) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.getMyTickets(userId);
  }

  // 7. 정기권/회수권 사용 내역 조회 (페이지네이션, 본인 소유만 조회 가능)
  @Get(SUBSCRIPTION_ROUTES.v1.USAGE_HISTORY)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "정기권/회수권 사용 내역 조회" })
  async getUsageHistory(
    @Req() req: Request,
    @Param("id") id: string,
    @Query() query: PaginationQueryDto,
  ) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.getUsageHistory(userId, id, query);
  }
}
