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
import { PaginationQueryDto } from "../../shared/dtos";
import {
  CreateSubscriptionLedgerDto,
  UpdateSubscriptionLedgerDto,
} from "../dtos";
import { SUBSCRIPTION_LEDGER_ROUTES } from "../routes";
import { SubscriptionLedgerService } from "../services/subscription-ledger.service";

@ApiTags("SubscriptionLedger")
@ApiBearerAuth()
@Controller(SUBSCRIPTION_LEDGER_ROUTES.v1.BASE)
export class SubscriptionLedgerController {
  constructor(
    private readonly subscriptionLedgerService: SubscriptionLedgerService,
  ) {}

  // 나의 정기권/회수권 사용 내역 (일반 사용자)
  @Get(SUBSCRIPTION_LEDGER_ROUTES.v1.MINE)
  @HttpCode(HttpStatus.OK)
  async findMine(@Req() req: Request, @Query() query: PaginationQueryDto) {
    const userId = req.user?.userId || "";
    return this.subscriptionLedgerService.findMine(userId, query);
  }

  // ── 아래는 ADMIN 전용 (내역 수동 생성/조회/보정) ──────────────────────────

  @Roles(ROLES.ADMIN)
  @Post(SUBSCRIPTION_LEDGER_ROUTES.v1.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("정기권/회수권 내역이 생성되었습니다.")
  async create(@Body() dto: CreateSubscriptionLedgerDto) {
    return this.subscriptionLedgerService.create(dto);
  }

  @Roles(ROLES.ADMIN)
  @Get(SUBSCRIPTION_LEDGER_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: PaginationQueryDto) {
    return this.subscriptionLedgerService.findAll(query);
  }

  @Roles(ROLES.ADMIN)
  @Get(SUBSCRIPTION_LEDGER_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    return this.subscriptionLedgerService.findOne(id);
  }

  @Roles(ROLES.ADMIN)
  @Patch(SUBSCRIPTION_LEDGER_ROUTES.v1.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("정기권/회수권 내역이 수정되었습니다.")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriptionLedgerDto,
  ) {
    return this.subscriptionLedgerService.update(id, dto);
  }

  @Roles(ROLES.ADMIN)
  @Delete(SUBSCRIPTION_LEDGER_ROUTES.v1.DELETE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("정기권/회수권 내역이 삭제되었습니다.")
  async remove(@Param("id") id: string) {
    return this.subscriptionLedgerService.remove(id);
  }
}
