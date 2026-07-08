import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../../shared/decorators/public.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { CreateSubscriptionDto, IssueBillingKeyDto } from "../dtos";
import { SUBSCRIPTION_ROUTES } from "../routes";
import { SubscriptionService } from "../services/subscription.service";

@ApiTags("Subscription")
@Controller(SUBSCRIPTION_ROUTES.v1.BASE)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // 1. 요금제 목록 조회 (비로그인 공개)
  @Public()
  @Get(SUBSCRIPTION_ROUTES.v1.PLANS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "구독 요금제 목록 조회" })
  async listPlans() {
    return this.subscriptionService.listPlans();
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

  // 5. 내 구독 상태 확인
  @Get(SUBSCRIPTION_ROUTES.v1.MINE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "나의 현재 구독 정보 조회" })
  async getMySubscription(@Req() req: Request) {
    const userId = req.user?.userId || "";
    return this.subscriptionService.getMySubscription(userId);
  }
}
