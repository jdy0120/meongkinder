import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { Public } from "../../shared/decorators/public.decorator";
import { ResponseMessage } from "../../shared/decorators/response-message.decorator";
import { CreateSubscriptionDto, IssueBillingKeyDto } from "../dtos";
import { PLATFORM_SUBSCRIPTION_ROUTES } from "../routes";
import { PlatformSubscriptionService } from "../services/platform-subscription.service";

/**
 * 매장 개설권 구독 (job-034).
 *
 * 원생 이용권과 달리 **테넌트 컨텍스트 없이** 호출된다 — 테넌트를 만들기 전에 결제하는 흐름이라
 * @Roles 를 붙이지 않는다(인증된 회원이면 누구나). 실제 개설 제한은 온보딩에서 미사용 개설권
 * 보유 여부로 판정한다.
 */
@ApiTags("PlatformSubscription")
@Controller(PLATFORM_SUBSCRIPTION_ROUTES.v1.BASE)
export class PlatformSubscriptionController {
  constructor(private readonly service: PlatformSubscriptionService) {}

  // 매장 개설권 요금제 목록 (비로그인 공개 — 가격표를 랜딩에서 보여줘야 한다)
  @Public()
  @Get(PLATFORM_SUBSCRIPTION_ROUTES.v1.PLANS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "매장 개설권 요금제 목록" })
  async listPlans() {
    return this.service.listPlans();
  }

  // 회원 소유 카드 등록
  @Post(PLATFORM_SUBSCRIPTION_ROUTES.v1.BILLING_KEY)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "매장 개설권 결제 수단 등록" })
  @ResponseMessage("결제 수단이 등록되었습니다.")
  async registerBillingKey(
    @Req() req: Request,
    @Body() dto: IssueBillingKeyDto,
  ) {
    return this.service.registerBillingKey(req.user!.userId, dto);
  }

  // 개설권 구독 + 첫 결제
  @Post(PLATFORM_SUBSCRIPTION_ROUTES.v1.SUBSCRIBE)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: "매장 개설권 구독" })
  @ResponseMessage("구독이 완료되었습니다. 이제 매장을 개설할 수 있습니다.")
  async subscribe(@Req() req: Request, @Body() dto: CreateSubscriptionDto) {
    return this.service.subscribe(req.user!.userId, dto.planId);
  }

  // 내 개설권 목록 (사용/미사용)
  @Get(PLATFORM_SUBSCRIPTION_ROUTES.v1.MINE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "내 매장 개설권 목록" })
  async listMine(@Req() req: Request) {
    return this.service.listMine(req.user!.userId);
  }

  // 구독 해지 예약
  @Post(PLATFORM_SUBSCRIPTION_ROUTES.v1.CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "매장 개설권 구독 해지" })
  @ResponseMessage("구독이 해지 예약되었습니다.")
  async cancel(@Req() req: Request, @Param("id") id: string) {
    return this.service.cancel(req.user!.userId, id);
  }
}
