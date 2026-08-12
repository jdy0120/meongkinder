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
  ChargeLedgerDto,
  CreateSubscriptionLedgerDto,
  RefundSaleDto,
  SellTicketDto,
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

  /**
   * 보호자 - 내 아이별 이용권 잔액 + 최근 사용 내역 (job-045).
   *
   * 잔액이 아이 단위라 페이지네이션 목록 하나로는 "우리 초코 몇 번 남았지"에 답할 수 없다.
   * 아이 수는 많아야 서너 마리라 전부 내려준다.
   */
  @Get(SUBSCRIPTION_LEDGER_ROUTES.v1.MINE)
  @HttpCode(HttpStatus.OK)
  async findMine(@Req() req: Request) {
    const userId = req.user?.userId || "";
    return this.subscriptionLedgerService.findMineByPet(userId);
  }

  // ── 아래는 TENANT_ADMIN/SUPER_ADMIN 전용 (내역 수동 생성/조회/보정) ─────────

  /**
   * 이용권 충전 (job-045) — 원장이 현장에서 결제받고 횟수를 넣어준다.
   *
   * 토스 결제 흐름(`v1/subscriptions/subscribe`)과 별개로 둔 이유: 유치원 현금·계좌이체
   * 결제가 실무에서 그대로 쓰이고, 그 경우에도 잔액은 시스템이 알아야 한다. 이게 없으면
   * 잔액이 0에서 시작해 등원할 때마다 음수로 내려간다(예전 상태).
   */
  /**
   * 현장 판매 (job-051) — 요금제를 골라 대면 결제로 이용권을 개통한다.
   *
   * STAFF 에게도 연다: 처음 온 보호자를 맞고 이용권을 파는 건 데스크 업무다(job-046 이
   * 원생 등록을 STAFF 에게 연 것과 같은 이유 — 원장이 자리를 비우면 아무것도 못 판다).
   * 반면 **매출 조회는 TENANT_ADMIN 전용**이다. 파는 것과 장부를 보는 것은 다른 권한이다.
   */
  @Roles(ROLES.STAFF, ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Post(SUBSCRIPTION_LEDGER_ROUTES.v1.SELL)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("이용권이 판매되었습니다.")
  async sell(@Body() dto: SellTicketDto) {
    return this.subscriptionLedgerService.sell(dto);
  }

  /**
   * 판매 환불 (job-054) — 매출을 차감하고 남은 이용권을 회수한다.
   *
   * **TENANT_ADMIN 전용이다.** 파는 것(`sell`)은 데스크 업무라 STAFF 에게 열었지만,
   * 환불은 돈을 되돌리는 결정이라 경영 권한이다.
   *
   * 카드 결제였다면 응답에 `paymentKey` 가 실려 온다 — **PG 취소는 자동으로 하지 않으므로**
   * 원장이 `POST v1/payments/:paymentKey/cancel` 을 따로 실행해야 실제 돈이 돌아간다.
   */
  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Post(SUBSCRIPTION_LEDGER_ROUTES.v1.REFUND_SALE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("환불 처리되었습니다.")
  async refundSale(@Param("id") id: string, @Body() dto: RefundSaleDto) {
    return this.subscriptionLedgerService.refundSale(id, dto);
  }

  /**
   * 횟수 수동 보정 — **판매가 아니다**. 서비스 보상이나 오류 정정용이라 매출을 만들지 않는다.
   * 돈을 받고 파는 것은 위의 `sell` 이다.
   */
  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Post(SUBSCRIPTION_LEDGER_ROUTES.v1.CHARGE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("이용권 횟수가 보정되었습니다.")
  async charge(@Body() dto: ChargeLedgerDto) {
    return this.subscriptionLedgerService.charge(dto);
  }

  /** 아이 1마리의 현재 잔여 횟수 (출석부·원생 화면에서 표시) */
  @Roles(ROLES.STAFF, ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(SUBSCRIPTION_LEDGER_ROUTES.v1.BALANCE)
  @HttpCode(HttpStatus.OK)
  async balance(@Param("petId") petId: string) {
    return {
      petId,
      balance: await this.subscriptionLedgerService.balanceOf(petId),
    };
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Post(SUBSCRIPTION_LEDGER_ROUTES.v1.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("정기권/회수권 내역이 생성되었습니다.")
  async create(@Body() dto: CreateSubscriptionLedgerDto) {
    return this.subscriptionLedgerService.create(dto);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(SUBSCRIPTION_LEDGER_ROUTES.v1.LIST)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: PaginationQueryDto) {
    return this.subscriptionLedgerService.findAll(query);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Get(SUBSCRIPTION_LEDGER_ROUTES.v1.GET)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    return this.subscriptionLedgerService.findOne(id);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Patch(SUBSCRIPTION_LEDGER_ROUTES.v1.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("정기권/회수권 내역이 수정되었습니다.")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriptionLedgerDto,
  ) {
    return this.subscriptionLedgerService.update(id, dto);
  }

  @Roles(ROLES.TENANT_ADMIN, ROLES.SUPER_ADMIN)
  @Delete(SUBSCRIPTION_LEDGER_ROUTES.v1.DELETE)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("정기권/회수권 내역이 삭제되었습니다.")
  async remove(@Param("id") id: string) {
    return this.subscriptionLedgerService.remove(id);
  }
}
